// @vitest-environment jsdom
import type {
  SupplierCycle,
  SupplierDetail,
  SupplierOverview,
  TeamResponse,
} from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Oberflächentests zu docs/specs/NAV-06.md: Arbeitsbereich eines Lieferanten.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const id = '0190a0a0-0000-7000-8000-000000000001';
const base = `/lieferanten/${id}`;
const detail: SupplierDetail = {
  relationshipId: id,
  name: 'Rheintal Elektronik GmbH (Demo)',
  organizationName: 'Rheintal Elektronik GmbH (Demo)',
  country: 'DE',
  vatId: null,
  duns: null,
  externalRef: 'L-10001',
  notes: null,
  status: 'active',
  createdAt: '2026-10-01T08:00:00Z',
  endedAt: null,
  spend: [{ year: 2025, amount: { amountCents: 420_000_00, currency: 'EUR' } }],
  permissions: { edit: true, editTeam: true },
};
const lena = { userId: 'lena', name: 'Lena Berger', teamRole: 'sro', function: 'purchasing' };
const tom = { userId: 'tom', name: 'Tom Krüger', teamRole: 'sponsor', function: 'quality' };
const sampleCycle = (): SupplierCycle => ({
  id: '0190a0a0-0000-7000-8000-000000000002',
  label: '2026',
  startedAt: '2026-01-01T00:00:00.000Z',
  jbpDate: null,
  schedule: [
    { step: 'feedback', weeksRelativeToJbp: -8, reminderDaysBefore: 7, dueDate: null },
    { step: 'touchpoints', weeksRelativeToJbp: -6, reminderDaysBefore: 7, dueDate: null },
    { step: 'supplierPlan', weeksRelativeToJbp: -2, reminderDaysBefore: 7, dueDate: null },
    { step: 'jbp', weeksRelativeToJbp: 0, reminderDaysBefore: 7, dueDate: null },
    { step: 'scorecard', weeksRelativeToJbp: 3, reminderDaysBefore: 7, dueDate: null },
  ],
  steps: [
    { key: 'segment', status: 'open', href: `${base}/strategie/segmentierung`, dueDate: null },
    { key: 'feedback', status: 'unavailable', href: null, dueDate: null },
    { key: 'touchpoints', status: 'unavailable', href: null, dueDate: null },
    { key: 'supplierPlan', status: 'unavailable', href: null, dueDate: null },
    { key: 'jbp', status: 'unavailable', href: null, dueDate: null },
    { key: 'scorecard', status: 'unavailable', href: null, dueDate: null },
    { key: 'execution', status: 'unavailable', href: null, dueDate: null },
  ],
});
let cycle: SupplierCycle | null;
let isFocus: boolean;
let canStartCycle: boolean;
let canSetJbpDate: boolean;
const overviewWith = (sro: { userId: string; name: string } | null): SupplierOverview => ({
  head: { segment: null, sro, nextMeeting: null, isFocus },
  metrics: [
    {
      tile: 'strategy',
      kind: 'spend',
      year: 2025,
      amount: { amountCents: 420_000_00, currency: 'EUR' },
    },
    { tile: 'relationship', kind: 'team_size', count: 2 },
  ],
  cycle,
  canStartCycle,
  canSetJbpDate,
});

let requests: { method: string; url: string }[] = [];
let team: TeamResponse;

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  requests = [];
  cycle = null;
  isFocus = false;
  canStartCycle = false;
  canSetJbpDate = false;
  team = {
    members: [lena, tom] as TeamResponse['members'],
    candidates: [
      { userId: 'lena', name: 'Lena Berger', defaultFunction: 'purchasing' },
      { userId: 'tom', name: 'Tom Krüger', defaultFunction: 'quality' },
    ],
  };
  api.handle = (request) => {
    requests.push(request);
    if (request.url === `/api/suppliers/${id}`) return Response.json(detail);
    if (request.url === `/api/suppliers/${id}/overview`) {
      // Der Kopf liest den SRO aus dem Team, wie die API.
      const sro = team.members.find((member) => member.teamRole === 'sro');
      return Response.json(overviewWith(sro ? { userId: sro.userId, name: sro.name } : null));
    }
    if (request.url === `/api/suppliers/${id}/cycle` && request.method === 'POST') {
      cycle = sampleCycle();
      return Response.json(cycle);
    }
    if (request.url === `/api/suppliers/${id}/team`) {
      if (request.method === 'PUT') {
        const body = request.body as { members: { userId: string; teamRole: string }[] };
        team = {
          ...team,
          members: body.members.map((member) => ({
            ...member,
            name: member.userId === 'lena' ? 'Lena Berger' : 'Tom Krüger',
            function: null,
          })) as TeamResponse['members'],
        };
      }
      return Response.json(team);
    }
    if (request.url.startsWith('/api/audit')) return Response.json({ entries: [] });
    return undefined;
  };
});

afterEach(tearDownApp);

const localBar = () => screen.getByRole('navigation', { name: 'Bereiche des Lieferanten' });
const areas = [
  { label: 'Strategie', path: `${base}/strategie` },
  { label: 'Beziehung', path: `${base}/beziehung` },
  { label: 'Gemeinsamer Plan', path: `${base}/plan` },
  { label: 'Umsetzung', path: `${base}/umsetzung` },
  { label: 'Wirkung', path: `${base}/wirkung` },
];

describe('Arbeitsbereich eines Lieferanten', () => {
  it('Alle sechs Bereiche haben eigene Adressen. Der aktive ist markiert, und der Wechsel lädt die Seite nicht neu.', async () => {
    const router = renderAt(base);
    // Auf dem Überblick steht der Name des Lieferanten groß in der Bühne (PLT-10).
    await screen.findByRole('heading', { level: 1, name: 'Rheintal Elektronik GmbH (Demo)' });
    const links = within(localBar()).getAllByRole('listitem');
    expect(links.map((item) => item.textContent)).toEqual([
      'Überblick',
      'Strategie',
      'Beziehung',
      'Gemeinsamer Plan',
      'Umsetzung',
      'Wirkung',
    ]);
    // Der Name steht links in der Leiste und führt zum Überblick.
    expect(within(localBar()).getByRole('link', { name: detail.name }).getAttribute('href')).toBe(
      base,
    );
    expect(
      within(localBar()).getByRole('link', { name: 'Überblick' }).getAttribute('aria-current'),
    ).toBe('page');

    // Ohne Neuladen bleibt der Rahmen mit der Leiste derselbe; der Browser-Test prüft es echt.
    const bar = localBar();
    for (const area of areas) {
      fireEvent.click(within(localBar()).getByRole('link', { name: area.label }));
      await waitFor(() => expect(router.state.location.pathname).toBe(area.path));
      expect(await screen.findByRole('heading', { level: 1, name: area.label })).toBeDefined();
      const active = within(localBar())
        .getAllByRole('link')
        .filter((link) => link.getAttribute('aria-current') === 'page');
      expect(active.map((link) => link.textContent)).toEqual([area.label]);
    }
    expect(localBar()).toBe(bar);
  });

  it('Jede Bereichsseite zeigt ihre Unterseiten als Kacheln. Höchstens sechs je Seite.', async () => {
    const expected: Record<string, string[]> = {
      Strategie: ['Segmentierung', 'Lieferantenplan', 'Spend', 'Profil'],
      Beziehung: ['Team', 'Spielregeln', 'Feedback', 'Kontaktpunkte'],
      'Gemeinsamer Plan': ['Vorbereitung', 'Themen', 'Initiativen', 'Zusagen', 'Scorecard'],
      Umsetzung: ['Termine', 'Maßnahmen'],
      Wirkung: ['Wirkung je Initiative', 'Monatswerte', 'P&L-Brücke'],
    };
    for (const area of areas) {
      renderAgain(area.path);
      const list = await screen.findByRole('list', { name: area.label });
      const titles = within(list)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent);
      expect(titles).toEqual(expected[area.label]);
      expect(titles.length).toBeLessThanOrEqual(6);
    }
  });

  it('Kacheln führen zu ihren verfügbaren Unterseiten; fehlende zeigen den Release-Hinweis', async () => {
    const router = renderAt(`${base}/strategie`);
    const list = await screen.findByRole('list', { name: 'Strategie' });
    const plan = within(list).getAllByRole('listitem')[1] as HTMLElement;
    expect(
      within(plan).getByRole('link', { name: 'Lieferantenplan öffnen' }).getAttribute('href'),
    ).toBe(`${base}/strategie/lieferantenplan`);
    expect(
      within(list).getByRole('link', { name: 'Segmentierung öffnen' }).getAttribute('href'),
    ).toBe(`${base}/strategie/segmentierung`);

    fireEvent.click(within(list).getByRole('link', { name: 'Spend öffnen' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${base}/strategie/spend`));
  });

  it('Der Kopf zeigt die Werte aus ihrem Ort. Ein Test ändert den SRO im Team und prüft den Kopf.', async () => {
    renderAt(base);
    const big = await screen.findByLabelText('Stand der Beziehung');
    expect(big.textContent).toBe('Segmentnoch offenSROLena Berger');
    // Ohne Termin entfällt die Angabe.
    expect(within(big).queryByText('Nächster Termin')).toBeNull();

    // Neuer SRO im Team: Der Kopf liest ihn dort, ohne eigene Kopie.
    const router = renderAgain(`${base}/beziehung/team/bearbeiten`);
    await screen.findByRole('heading', { level: 1, name: 'Team bearbeiten' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Teamrolle: Lena Berger' }), {
      target: { value: 'member' },
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'Teamrolle: Tom Krüger' }), {
      target: { value: 'sro' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${base}/beziehung/team`));
    // Auf allen Seiten außer dem Überblick steht der Kopf als schmale Zeile.
    await waitFor(() =>
      expect(screen.getByLabelText('Stand der Beziehung').textContent).toBe(
        'Segmentnoch offenSROTom Krüger',
      ),
    );
  });

  it('Die Zyklus-Leiste zeigt sieben Schritte und führt zum ersten offenen Schritt', async () => {
    cycle = sampleCycle();
    isFocus = true;
    const router = renderAt(base);
    await screen.findByRole('heading', { level: 2, name: 'Zyklus 2026' });
    expect(screen.getAllByText('Noch nicht verfügbar')).toHaveLength(6);
    const next = screen.getByRole('link', {
      name: 'Nächster Schritt: Segment konsolidieren',
    });
    expect(next.getAttribute('href')).toBe(`${base}/strategie/segmentierung`);
    fireEvent.click(next);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${base}/strategie/segmentierung`),
    );
  });

  it('SRO/Admin können einen fehlenden Fokus-Zyklus starten', async () => {
    isFocus = true;
    canStartCycle = true;
    renderAt(base);
    fireEvent.click(await screen.findByRole('button', { name: 'Zyklus starten' }));
    await screen.findByRole('heading', { level: 2, name: 'Zyklus 2026' });
    expect(cycle).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Zyklus starten' })).toBeNull();
  });

  it('Der Überblick speichert keine eigenen Daten. Ohne Modul zeigt die Kachel den Release-Hinweis.', async () => {
    renderAt(base);
    const list = await screen.findByRole('list', { name: 'Überblick' });
    await waitFor(() => expect(list.textContent).toContain('Spend 2025'));
    const tiles = within(list).getAllByRole('listitem');
    expect(tiles.map((tile) => tile.querySelector('h3')?.textContent)).toEqual([
      'Strategie',
      'Beziehung',
      'Gemeinsamer Plan',
      'Umsetzung',
      'Wirkung',
      'Hinweise',
    ]);
    expect(tiles[1]?.textContent).toContain('2Personen im Team');
    expect(tiles[2]?.textContent).toContain('Kommt nach Release 1.0');
    expect(tiles[3]?.textContent).toContain('Kommt mit Release 1.0');
    expect(tiles[4]?.textContent).toContain('Kommt nach Release 1.0');
    expect(tiles[5]?.textContent).toContain('Kommt nach Release 1.0');
    // Jede Bereichskachel hat „Öffnen“, die Hinweise haben noch keine Seite.
    expect(
      within(tiles[2] as HTMLElement).getByRole('link', { name: 'Gemeinsamer Plan öffnen' }),
    ).toBeDefined();
    expect(within(tiles[5] as HTMLElement).queryByRole('link')).toBeNull();
    // Der Überblick liest nur.
    expect(requests.filter((request) => request.method !== 'GET')).toEqual([]);
  });

  it('Jede Seite im Bereich Strategie trägt das Kennzeichen „Intern“', async () => {
    const strategyPages: [path: string, title: string][] = [
      ['strategie', 'Strategie'],
      ['strategie/profil', 'Profil'],
      ['strategie/profil/bearbeiten', 'Deine Werte bearbeiten'],
      ['strategie/spend', 'Spend'],
      ['strategie/spend/neu', 'Jahr hinzufügen'],
      ['strategie/spend/2025', 'Spend 2025'],
    ];
    for (const [path, title] of strategyPages) {
      renderAgain(`${base}/${path}`);
      const heading = await screen.findByRole('heading', { level: 1, name: title });
      const badge = heading.closest('header')?.querySelector('[data-visibility="internal"]');
      expect(badge?.textContent, path).toBe('Intern');
    }
    // Andere Bereiche tragen es nicht als Bereich.
    renderAgain(`${base}/beziehung`);
    const heading = await screen.findByRole('heading', { level: 1, name: 'Beziehung' });
    expect(heading.closest('header')?.querySelector('[data-visibility]')).toBeNull();
  });

  it('Die Seiten aus PLT-03 und PLT-05 (Profil, Spend, Team) liegen im Arbeitsbereich und haben einen Pfad mit Zurück.', async () => {
    const pages = [
      {
        path: `${base}/strategie/profil`,
        title: 'Profil',
        area: 'Strategie',
        back: `${base}/strategie`,
      },
      {
        path: `${base}/strategie/spend`,
        title: 'Spend',
        area: 'Strategie',
        back: `${base}/strategie`,
      },
      {
        path: `${base}/beziehung/team`,
        title: 'Team',
        area: 'Beziehung',
        back: `${base}/beziehung`,
      },
    ];
    for (const page of pages) {
      const router = renderAgain(page.path);
      await screen.findByRole('heading', { level: 1, name: page.title });
      // In der lokalen Leiste ist der Bereich markiert.
      expect(
        within(localBar()).getByRole('link', { name: page.area }).getAttribute('aria-current'),
      ).toBe('page');
      const path = screen.getByRole('navigation', { name: 'Pfad' });
      expect(
        within(path)
          .getAllByRole('link')
          .map((link) => link.textContent)
          .filter(Boolean),
      ).toEqual(['Lieferanten', detail.name, page.area]);
      fireEvent.click(within(path).getByRole('link', { name: `Zurück zu ${page.area}` }));
      await waitFor(() => expect(router.state.location.pathname).toBe(page.back));
    }
  });
});

/** Zweite Seite im selben Test: neu aufbauen, Antworten der API bleiben. */
function renderAgain(path: string) {
  const handle = api.handle;
  tearDownApp();
  setUpApp();
  api.permissions = actionsFor.admin;
  api.handle = handle;
  return renderAt(path);
}
