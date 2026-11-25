// @vitest-environment jsdom
import { defaultAiSettings, defaultHintThresholds } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  actionsFor,
  anna,
  api,
  renderAt,
  setUpApp,
  signedIn,
  tearDownApp,
  todayAllResponse,
} from '@/testing/app-harness';

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

// KI-16 für die Oberfläche: Hinweise nach score mit Filtern und Leiste (Beleg, Begründung als
// Entwurf, nächster Schritt, In Arbeit, Bewertung), „Wo du handeln musst“ in Mein Tag, Abschnitt
// Hinweise in den Einstellungen KI und die vorausgefüllte Maßnahme.

const rel = '550e8400-e29b-41d4-a716-446655440010';
const other = '550e8400-e29b-41d4-a716-446655440011';
const base = {
  relationshipId: rel,
  supplier: 'Silesia Guss',
  status: 'open',
  reason: null,
  createdAt: '2026-11-14T06:00:00Z',
  decidedAt: null,
  decidedByName: null,
  canAccept: true,
  canDismiss: true,
  actionHref: null,
  title: null,
  explanation: null,
  feedback: null,
  lastSeenAt: '2026-11-23T06:00:00Z',
  resolvedReason: null,
  isFocus: true,
  isOwn: true,
  materialGroup: 'Guss',
  suggestedAction: null,
  evidence: {},
};
const hintId = (n: number) => `550e8400-e29b-41d4-a716-4466554401${String(n).padStart(2, '0')}`;
const drop = {
  ...base,
  id: hintId(1),
  ruleKey: 'performance_drop',
  severity: 'high',
  score: 900,
  detail: { kpi: 'Liefertreue', months: 3 },
  evidence: {
    metric: 'Liefertreue',
    values: [
      { label: '2026-08', value: '91 %' },
      { label: '2026-09', value: '88 %' },
      { label: '2026-10', value: '86 %' },
    ],
    threshold: 'Ziel 95 %',
    refs: [{ objectType: 'scorecard_kpi', objectId: 'k1', title: 'Scorecard Liefertreue' }],
  },
  explanation: 'Silesia liefert seit drei Monaten unter Ziel, im Oktober 86 % statt 95 %.',
  href: `/lieferanten/${rel}/umsetzung/massnahmen/neu?hinweis=${hintId(1)}`,
};
const dependency = {
  ...base,
  id: hintId(2),
  relationshipId: other,
  supplier: 'Pearl River Components',
  isFocus: false,
  isOwn: false,
  materialGroup: 'Elektronik',
  ruleKey: 'dependency',
  severity: 'medium',
  score: 500,
  detail: { group: 'Elektronik', share: 72 },
  href: '/warengruppen/g1',
};
const feedback = {
  ...base,
  id: hintId(3),
  ruleKey: 'feedback_drop',
  severity: 'medium',
  score: 300,
  detail: { before: 3.8, now: 3.3 },
  href: `/lieferanten/${rel}/beziehung/feedback`,
};
const low = (n: number) => ({
  ...base,
  id: hintId(10 + n),
  ruleKey: 'no_feedback',
  severity: 'low',
  score: 10 - n,
  detail: {},
  href: `/lieferanten/${rel}/beziehung/feedback`,
});

let hints: Record<string, unknown>[];
let posted: { url: string; body: unknown }[];
let rulesSaved: unknown;

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'admin' };
  api.permissions = actionsFor.admin;
  hints = [drop, dependency, feedback, low(1), low(2)];
  posted = [];
  rulesSaved = null;
  api.handle = (request) => {
    // HE-01 (K1-e.4): Warum zum Hinweis liest erst die Art, dann den Hinweis
    if (request.url.startsWith('/api/warum/')) {
      return Response.json({ kind: 'hint', hintId: request.url.split('/').pop() });
    }
    if (request.url === '/api/hinweise') return Response.json({ hints, checkedAt: null });
    if (request.url === '/api/hinweise/regeln') {
      if (request.method === 'PUT') {
        rulesSaved = request.body;
        return Response.json({ ...(request.body as object), ratings: [] });
      }
      return Response.json({
        rules: { dependency: false },
        thresholds: defaultHintThresholds,
        ratings: [{ ruleKey: 'performance_drop', helpful: 3, notHelpful: 1 }],
      });
    }
    if (request.url === '/api/einstellungen/ki')
      return Response.json({ settings: defaultAiSettings, euOnly: true, canEdit: true });
    if (request.url === '/api/ki/kontingent')
      return Response.json({
        month: '2026-11',
        budgetMonthCents: 15_000,
        usedCents: 0,
        calls: 0,
        byFeature: [],
      });
    const match = request.url.match(/^\/api\/hinweise\/([^/]+)(?:\/(in-arbeit|bewertung))?$/);
    if (!match) return undefined;
    const hint = hints.find((entry) => entry.id === match[1]);
    if (!hint) return Response.json({ message: 'Nicht gefunden' }, { status: 404 });
    if (match[2] === 'in-arbeit') {
      posted.push({ url: request.url, body: null });
      return Response.json({ ...hint, status: 'in_progress' });
    }
    if (match[2] === 'bewertung') {
      posted.push({ url: request.url, body: request.body });
      return Response.json({
        ...hint,
        feedback: (request.body as { helpful: boolean }).helpful ? 'helpful' : 'not_helpful',
      });
    }
    return Response.json(hint);
  };
});

afterEach(tearDownApp);

describe('KI-16 Hinweise mit Frühwarnung', () => {
  // Die Liste der Hinweise ist seit K1-e.4 in Heute aufgegangen: Reihenfolge und Filter Schwere
  // prüft features/today/he-01.test.tsx (Inventar T1-I05), „Als Nächstes“ die Seite Heute.

  it('T1-I06, T1-I07: Warum zum Hinweis zeigt Beleg, Begründung mit Quellen, nächsten Schritt, In Arbeit und die Frage nach Hilfe', async () => {
    renderAt(`/warum/${drop.id}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Warum dieser Hinweis?' }),
    ).toBeTruthy();
    // T1-I05: Regel und Datum im Kopf
    expect(await screen.findByText(/^Leistung kippt · offen seit /)).toBeTruthy();
    expect(await screen.findByText('86 %')).toBeTruthy();
    expect(screen.getByText('Ziel 95 %')).toBeTruthy();
    const draft = document.querySelector('[data-slot="ai-draft"]') as HTMLElement;
    expect(within(draft).getByText(/im Oktober 86 % statt 95 %/)).toBeTruthy();
    expect(within(draft).getByText('Scorecard Liefertreue')).toBeTruthy();
    const next = document.querySelector('[data-slot="next-step"]') as HTMLElement;
    expect(within(next).getByText('Maßnahme anlegen')).toBeTruthy();
    expect(
      within(next)
        .getByRole('link', { name: 'Maßnahme vorausgefüllt öffnen' })
        .getAttribute('href'),
    ).toBe(drop.href);

    fireEvent.click(screen.getByRole('button', { name: 'In Arbeit' }));
    await waitFor(() => expect(posted[0]?.url).toBe(`/api/hinweise/${drop.id}/in-arbeit`));
    expect(await screen.findByText('Auf „In Arbeit“ gesetzt.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Nein' }));
    await waitFor(() => expect(posted[1]?.body).toEqual({ helpful: false }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Nein' }).getAttribute('aria-pressed')).toBe(
        'true',
      ),
    );
  });

  it('Heute, Ansicht Alles, zeigt die Hinweise, über die andere entscheiden; jede Zeile führt zum Hinweis', async () => {
    // HE-01 (K1-e): statt der Zeile „Hinweise“ auf Mein Tag die Gruppe „Hinweise“ in der Ansicht
    // Alles; Hinweise, über die die Person entscheidet, stehen als Fokus-Thema unter „Für dich“.
    api.todayAll = todayAllResponse({
      hints: [
        {
          id: '0190a0a0-0000-7000-8000-000000000071',
          title: 'Liefertreue sinkt seit drei Monaten',
          ruleKey: 'performance_drop',
          supplier: 'Silesia Guss',
          relationshipId: '0190a0a0-0000-7000-8000-000000000072',
          severity: 'high',
          materialGroup: 'Guss',
          openSince: '2026-11-20T06:00:00.000Z',
          suggestedAction: null,
          href: '/hinweise/0190a0a0-0000-7000-8000-000000000071',
        },
      ],
    });
    renderAt('/heute?ansicht=alles');
    const group = await screen.findByRole('region', { name: 'Hinweise · 1' });
    const row = within(group).getByRole('link', { name: /Liefertreue sinkt/ });
    expect(row.getAttribute('href')).toBe('/hinweise/0190a0a0-0000-7000-8000-000000000071');
    expect(within(row).getByText('hoch')).toBeTruthy();
    expect(row.textContent).toContain('Silesia Guss · Leistung kippt · Guss');
  });

  it('Einstellungen KI › Hinweise: Regel ausschalten, Schwelle ändern, Bewertung je Regel', async () => {
    renderAt('/einstellungen/ki');
    const section = (await screen.findByRole('heading', { level: 2, name: 'Hinweise' })).closest(
      'section',
    ) as HTMLElement;
    expect(await within(section).findByText('3 hilfreich · 1 nicht hilfreich')).toBeTruthy();
    const dependencySwitch = within(section).getByRole('switch', { name: 'Abhängigkeit' });
    expect(dependencySwitch.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(within(section).getByRole('switch', { name: 'Leistung kippt' }));
    fireEvent.change(within(section).getByLabelText('Leistung kippt: Monate unter Ziel'), {
      target: { value: '4' },
    });
    fireEvent.click(within(section).getByRole('button', { name: 'Regeln speichern' }));
    await waitFor(() =>
      expect(rulesSaved).toMatchObject({
        rules: { dependency: false, performance_drop: false },
        thresholds: { performance_drop: { months: 4 } },
      }),
    );
  });

  it('„Maßnahme anlegen“ öffnet das Formular mit Titel und Begründung aus dem Hinweis', async () => {
    const handle = api.handle;
    api.handle = (request) => {
      if (request.url === `/api/suppliers/${rel}`)
        return Response.json({
          relationshipId: rel,
          name: 'Silesia Guss',
          organizationName: 'Silesia Guss',
          country: 'PL',
          vatId: null,
          duns: null,
          externalRef: null,
          notes: null,
          status: 'active',
          createdAt: '2026-10-01T08:00:00Z',
          endedAt: null,
          spend: [],
          permissions: { edit: true, editTeam: true },
        });
      if (request.url.startsWith(`/api/suppliers/${rel}/overview`))
        return Response.json({
          head: { segment: null, sro: null, nextMeeting: null },
          metrics: [],
          cycle: null,
          canStartCycle: false,
          canSetJbpDate: false,
        });
      if (request.url === `/api/suppliers/${rel}/massnahmen`)
        return Response.json({
          actions: [],
          canCreate: true,
          people: [{ userId: 'u1', name: 'Anna Berg' }],
        });
      return handle?.(request);
    };
    renderAt(`/lieferanten/${rel}/umsetzung/massnahmen/neu?hinweis=${drop.id}`);
    const title = (await screen.findByLabelText('Was ist zu tun?')) as HTMLInputElement;
    expect(title.value).toBe('„Liefertreue“ seit 3 Monaten unter Ziel und schlechter werdend');
    expect((screen.getByLabelText(/Beschreibung/) as HTMLTextAreaElement).value).toContain(
      'im Oktober 86 % statt 95 %',
    );
  });
});
