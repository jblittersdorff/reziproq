// @vitest-environment jsdom
import type { FocusMap, FocusTopic, WhyView } from '@reziproq/shared';
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

// HE-01 Warum und Fokus-Mappe (K1-e.4, Vorlagen K1-Warum und K1-Mappe): Lauf mit Schritten, Kosten
// und Rechten (Inventar T1-I15), Rechenweg eines Fokus-Themas, die Mappe in fünf Teilen.

const uuid = (n: number) => `550e8400-e29b-41d4-a716-4466554404${String(n).padStart(2, '0')}`;
const rheintal = uuid(90);

const topic: FocusTopic = {
  id: uuid(1),
  level: 'focus',
  kind: 'approval',
  title: 'Preis Leiterplatten',
  sentence: 'Seit 2 Tagen überfällig.',
  facts: [
    {
      key: 'overdue_days',
      value: 2,
      unit: 'd',
      source: { objectType: 'validation', label: 'Frist' },
    },
  ],
  objectType: 'validation',
  objectId: uuid(41),
  relationshipId: rheintal,
  counterpart: 'Rheintal Elektronik',
  dueDate: '2026-11-23',
  href: `/lieferanten/${rheintal}/wirkung/freigaben/${uuid(41)}`,
  score: 1200,
  item: {
    id: uuid(41),
    kind: 'validation',
    supplier: 'Rheintal Elektronik',
    detail: 'Preis Leiterplatten',
    dueDate: '2026-11-23',
    href: `/lieferanten/${rheintal}/wirkung/freigaben/${uuid(41)}`,
  },
  art: 'wert',
  severity: null,
  materialGroup: 'Leiterplatten',
};

const run: WhyView = {
  kind: 'run',
  run: {
    id: uuid(2),
    task: 'meeting_brief',
    taskName: 'Termin-Briefing',
    status: 'done',
    trigger: 'schedule',
    at: '2026-11-23T05:10:00.000Z',
    steps: 14,
    costMicrocents: 21_000_000,
    tools: ['qbr_facts', 'supplier_context'],
    counterpart: 'Rheintal Elektronik',
    relationshipId: rheintal,
    undone: false,
  },
  steps: [
    { seq: 1, title: 'Daten lesen', kind: 'tool', status: 'done' },
    { seq: 2, title: 'Ergebnis entwerfen', kind: 'model', status: 'done' },
  ],
  statements: [{ text: 'Liefertreue im Oktober 86 % statt 95 %.', sources: ['Scorecard 2026'] }],
  sources: [{ title: 'Scorecard 2026', href: null }],
};

let views: Record<string, WhyView>;
let map: FocusMap;
let snoozed: string[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  views = {
    [uuid(1)]: { kind: 'topic', topic, rank: 1, sources: [{ title: 'Frist', href: null }] },
    [uuid(2)]: run,
  };
  map = {
    topic,
    state: 'open',
    since: '2026-11-21T06:00:00.000Z',
    rank: 1,
    hintId: null,
    recommendation: null,
    sources: [{ title: 'Frist', href: null }],
  };
  snoozed = [];
  api.handle = (request) => {
    const why = request.url.match(/^\/api\/warum\/(.+)$/);
    if (why?.[1]) {
      const view = views[why[1]];
      return view ? Response.json(view) : Response.json({ statusCode: 404 }, { status: 404 });
    }
    if (request.url === `/api/mappe/${uuid(1)}`) return Response.json(map);
    if (request.method === 'POST' && request.url.endsWith('/morgen')) {
      snoozed.push(request.url);
      return Response.json({ snoozedUntil: '2026-11-24T06:00:00.000Z' });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('HE-01 Warum', () => {
  it('T1-I15: Lauf mit Schritten, Aussagen und Quellen, Zeit, Kosten und Rechten', async () => {
    renderAt(`/warum/${uuid(2)}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Warum: Termin-Briefing' }),
    ).toBeTruthy();
    const steps = screen.getByRole('region', { name: 'Was Reziproq getan hat' });
    expect(within(steps).getByText('Daten lesen')).toBeTruthy();
    expect(within(steps).getByText('Ergebnis entwerfen')).toBeTruthy();
    const said = document.querySelector('[data-slot="ai-draft"]') as HTMLElement;
    expect(within(said).getByText('Liefertreue im Oktober 86 % statt 95 %.')).toBeTruthy();
    expect(within(said).getByText('Scorecard 2026')).toBeTruthy();
    const facts = screen.getByRole('region', { name: 'Lauf' });
    expect(within(facts).getByText(/14 Schritte · 0,21 €$/)).toBeTruthy();
    expect(within(facts).getByText('Zeitplan')).toBeTruthy();
    expect(within(facts).getByText('qbr_facts, supplier_context')).toBeTruthy();
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: 'Heute' }).getAttribute('href'),
    ).toBe('/heute');
  });

  it('Fokus-Thema: Rechenweg aus den Fakten, Punktzahl mit Platz und der geprüfte Satz', async () => {
    renderAt(`/warum/${uuid(1)}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Warum steht das hier?' }),
    ).toBeTruthy();
    const math = await screen.findByRole('region', { name: 'Rechenweg' });
    expect(within(math).getByText('Frist')).toBeTruthy();
    expect(within(math).getByText('Tage überfällig, aus der Frist')).toBeTruthy();
    expect(within(math).getByText('2 d')).toBeTruthy();
    expect(within(math).getByText('1200')).toBeTruthy();
    expect(within(math).getByText(/Platz 1 unter deinen Fokus-Themen/)).toBeTruthy();
    expect(screen.getByText('Seit 2 Tagen überfällig.')).toBeTruthy();
  });

  it('Ohne Zugriff: Fehler statt Inhalt', async () => {
    renderAt(`/warum/${uuid(9)}`);
    expect(await screen.findByText('Die Herleitung konnte nicht geladen werden.')).toBeTruthy();
  });
});

describe('HE-01 Fokus-Mappe', () => {
  it('Fünf Teile: worum es geht, Belege, Optionen, dein Schritt; rechts So geht es weiter und Nur für dich', async () => {
    renderAt(`/mappe/wert/${uuid(1)}`);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Wirkung freigeben · Preis Leiterplatten',
      }),
    ).toBeTruthy();
    // Dein Schritt: genau eine Karte „Als Nächstes“, der Hauptknopf führt zum Ort
    const card = document.querySelector('[data-slot="next-card"]') as HTMLElement;
    expect(within(card).getByText('Als Nächstes · dein Schritt')).toBeTruthy();
    expect(within(card).getByRole('link').getAttribute('href')).toBe(topic.href);
    // Worum es geht und Belege mit dem Weg ins Warum
    expect(screen.getByRole('region', { name: 'Worum es geht' })).toBeTruthy();
    const evidence = screen.getByRole('region', { name: 'Belege' });
    expect(within(evidence).getByRole('link').getAttribute('href')).toBe(`/warum/${uuid(1)}`);
    // Optionen ohne Zahl, solange die Wert-Engine nicht rechnet (G-6); keine Empfehlung ohne Grundlage
    const options = screen.getByRole('region', { name: 'Optionen' });
    expect(within(options).getAllByText(/^[AB] · /)).toHaveLength(2);
    expect(within(options).queryByText('Empfohlen')).toBeNull();
    expect(
      screen.getByText('Werte für beide Seiten zeigt die Mappe, sobald die Wert-Engine rechnet.'),
    ).toBeTruthy();
    expect(screen.getByRole('region', { name: 'So geht es weiter' })).toBeTruthy();
    expect(screen.getByText('Nur für dich')).toBeTruthy();
  });

  it('Mit Hinweis: höchstens eine Empfehlung; der Hauptknopf führt ins Warum zum Hinweis', async () => {
    map = {
      ...map,
      hintId: uuid(30),
      recommendation: 'Zusage zur Liefertreue vorschlagen',
      topic: { ...topic, item: null, art: 'hinweis', title: 'Liefertreue sinkt' },
    };
    renderAt(`/mappe/hinweis/${uuid(1)}`);
    const card = (await screen.findByText('Als Nächstes · Empfehlung von Reziproq')).closest(
      '[data-slot="next-card"]',
    ) as HTMLElement;
    expect(
      within(card).getByRole('heading', { name: 'Zusage zur Liefertreue vorschlagen' }),
    ).toBeTruthy();
    expect(within(card).getByRole('link').getAttribute('href')).toBe(`/warum/${uuid(30)}`);
    const options = screen.getByRole('region', { name: 'Optionen' });
    expect(within(options).getAllByText('Empfohlen')).toHaveLength(1);
    expect(within(options).getByText('C · Nicht relevant')).toBeTruthy();
  });

  it('„Morgen erinnern“ stellt das Thema zurück', async () => {
    renderAt(`/mappe/wert/${uuid(1)}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Morgen erinnern' }));
    await waitFor(() => expect(snoozed).toEqual([`/api/heute/${uuid(1)}/morgen`]));
  });
});
