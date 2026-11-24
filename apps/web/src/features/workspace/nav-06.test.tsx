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
import { spendOverviewOf } from '@/testing/spend';

// Oberflächentests zu docs/specs/NAV-06.md: Arbeitsbereich eines Lieferanten.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
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
const lena = {
  userId: 'lena',
  name: 'Lena Berger',
  teamRole: 'sro',
  function: 'purchasing',
  visibility: 'shared',
};
const tom = {
  userId: 'tom',
  name: 'Tom Krüger',
  teamRole: 'sponsor',
  function: 'quality',
  visibility: 'shared',
};
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
    side: 'buyer',
    counterpart: [],
    canEdit: true,
    sroDescription: null,
    members: [lena, tom] as TeamResponse['members'],
    candidates: [
      { userId: 'lena', name: 'Lena Berger', defaultFunction: 'purchasing' },
      { userId: 'tom', name: 'Tom Krüger', defaultFunction: 'quality' },
    ],
  };
  api.handle = (request) => {
    requests.push(request);
    if (request.url === `/api/suppliers/${id}`) return Response.json(detail);
    if (request.url === `/api/suppliers/${id}/spend`) return Response.json(spendOverviewOf(detail));
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

const header = () => document.querySelector('[data-slot="supplier-header"]') as HTMLElement;
const areas = () => screen.getByRole('navigation', { name: 'Bereiche des Lieferanten' });
const rows = () => screen.getByRole('region', { name: 'Stand der Beziehung' });

describe('Arbeitsbereich eines Lieferanten', () => {
  it('NAV-10 1.1: Der Lieferantenkopf zeigt vier Bereiche, den Knopf „···“ und die Unterseiten', async () => {
    const router = renderAt(base);
    // Auf dem Überblick ist der Name der Titel der Seite.
    await screen.findByRole('heading', { level: 1, name: 'Rheintal Elektronik GmbH (Demo)' });
    expect(within(header()).getByRole('link', { name: 'Lieferanten' }).getAttribute('href')).toBe(
      '/lieferanten',
    );
    expect(
      within(areas())
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Überblick', 'Aktivitäten', 'Plan', 'Ergebnisse']);
    expect(
      within(areas()).getByRole('link', { name: 'Überblick' }).getAttribute('aria-current'),
    ).toBe('page');
    for (const [label, path] of [
      ['Aktivitäten', 'aktivitaeten'],
      ['Plan', 'plan/vorbereitung'],
      ['Ergebnisse', 'wirkung/bruecke'],
    ] as const) {
      expect(within(areas()).getByRole('link', { name: label }).getAttribute('href')).toBe(
        `${base}/${path}`,
      );
    }
    const profile = within(header()).getByRole('link', { name: 'Profil, Segmentierung und Team' });
    expect(profile.getAttribute('href')).toBe(`${base}/strategie/profil`);
    fireEvent.click(profile);
    await waitFor(() => expect(router.state.location.pathname).toBe(`${base}/strategie/profil`));
    const pages = await screen.findByRole('navigation', { name: 'Seiten im Bereich' });
    expect(
      within(pages)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'Profil und Spend',
      'Segmentierung',
      'Warengruppen',
      'Lieferantenplan',
      'Team',
      'Spielregeln',
      'Kontaktpunkte',
    ]);
    // Der Knopf „···“ ist markiert, kein Bereich; auf Unterseiten trägt die Seite den Titel.
    expect(
      within(header())
        .getByRole('link', { name: 'Profil, Segmentierung und Team' })
        .getAttribute('aria-current'),
    ).toBe('page');
    expect(within(areas()).queryByRole('link', { current: 'page' })).toBeNull();
    await screen.findByRole('heading', { level: 1, name: 'Profil und Spend' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('Der Überblick zeigt die Zeilen mit Stand und Ziel, ohne Release-Hinweis und ohne Claims', async () => {
    renderAt(base);
    await screen.findByRole('region', { name: 'Stand der Beziehung' });
    const links = within(rows()).getAllByRole('link');
    expect(links.map((link) => link.querySelector('b')?.textContent)).toEqual([
      'Ergebnisse',
      'Aktivitäten',
      'Gemeinsamer Plan',
      'Team und Spielregeln',
      'Segment und Strategie',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `${base}/wirkung/bruecke`,
      `${base}/aktivitaeten`,
      `${base}/plan/vorbereitung`,
      `${base}/beziehung/team`,
      `${base}/strategie/segmentierung`,
    ]);
    // Strategie ist privat: grau mit Schloss und Text.
    const strategy = links[4] as HTMLElement;
    expect(strategy.querySelector('[data-visibility="internal"]')?.textContent).toBe(
      'nur eure Seite',
    );
    expect(document.body.textContent).not.toMatch(/Kommt (mit|nach) Release/);
    // UX-20: Mit Modul „claims“ und „risk“ aus keine Zeile zu Claims und Risiken.
    expect(document.body.textContent).not.toMatch(/Claims|Risiken/);
  });

  it('Die alten Bereichsadressen leiten auf die erste Seite ihres neuen Bereichs weiter', async () => {
    for (const [old, target] of [
      ['strategie', 'strategie/profil'],
      ['beziehung', 'beziehung/team'],
      ['plan', 'plan/vorbereitung'],
      ['umsetzung', 'umsetzung/termine'],
      ['wirkung', 'wirkung/bruecke'],
    ] as const) {
      const router = renderAgain(`${base}/${old}`);
      await waitFor(() => expect(router.state.location.pathname).toBe(`${base}/${target}`));
    }
  });

  it('Kopf und Zeilen zeigen die Werte aus ihrem Ort. Ein Test ändert den SRO im Team und prüft die Zeile.', async () => {
    renderAt(base);
    await screen.findByRole('region', { name: 'Stand der Beziehung' });
    // Graue Zeile im Kopf: ohne Segment „nicht bewertet“
    expect(header().textContent).toContain('nicht bewertet');
    await waitFor(() =>
      expect(
        within(rows()).getByRole('link', { name: /Team und Spielregeln/ }).textContent,
      ).toContain('SRO Lena Berger · 2 Personen im Team'),
    );

    // Neuer SRO im Team: Der Überblick liest ihn dort, ohne eigene Kopie.
    const router = renderAgain(`${base}/beziehung/team/bearbeiten`);
    await screen.findByRole('list', { name: 'Team' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Teamrolle: Lena Berger' }), {
      target: { value: 'member' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Teamrolle: Tom Krüger' }), {
      target: { value: 'sro' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${base}/beziehung/team`));
    renderAgain(base);
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Team und Spielregeln/ }).textContent).toContain(
        'SRO Tom Krüger',
      ),
    );
  });

  it('Die Schrittfolge zeigt vier Phasen; die sieben Schritte stehen eingeklappt darunter', async () => {
    cycle = sampleCycle();
    isFocus = true;
    const router = renderAt(base);
    const chain = await screen.findByRole('navigation', { name: 'Jahreszyklus 2026' });
    expect(
      within(chain)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['1Segment · jetzt', '2Plan · offen', '3JBP · offen', '4Ergebnisse · offen']);
    // Die Phase Segment öffnet den aktuellen Schritt; Phasen ohne Seite sind grau und ohne Link.
    expect(within(chain).getAllByRole('link')).toHaveLength(1);
    // Kopf: Schritt im Jahreszyklus
    expect(header().textContent).toContain('Schritt 1 von 7: Segment');
    const detail = screen
      .getByText('Alle Schritte des Zyklus')
      .closest('details') as HTMLDetailsElement;
    expect(detail.open).toBe(false);
    expect(within(detail).getAllByText('Noch nicht verfügbar')).toHaveLength(6);
    // „Als Nächstes“ führt in den aktuellen Schritt.
    const next = await screen.findByRole('link', { name: 'Schritt öffnen' });
    expect(next.closest('[data-slot="next-card"]')?.textContent).toContain('Segment konsolidieren');
    fireEvent.click(next);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`${base}/strategie/segmentierung`),
    );
  });

  it('SRO/Admin starten einen fehlenden Fokus-Zyklus über „Als Nächstes“ und eine eigene Seite', async () => {
    isFocus = true;
    canStartCycle = true;
    const router = renderAt(base);
    const next = await screen.findByRole('link', { name: 'Zyklus starten' });
    expect(next.getAttribute('href')).toBe(`${base}/zyklus/start`);
    fireEvent.click(next);
    await screen.findByRole('heading', { level: 1, name: 'Jahreszyklus starten' });
    fireEvent.click(screen.getByRole('button', { name: 'Zyklus starten' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(base));
    expect(cycle).not.toBeNull();
    await screen.findByRole('navigation', { name: 'Jahreszyklus 2026' });
    expect(screen.queryByRole('link', { name: 'Zyklus starten' })).toBeNull();
  });

  it('Der Überblick speichert keine eigenen Daten; die Zeilen zeigen den Stand aus den Modulen.', async () => {
    renderAt(base);
    await screen.findByRole('region', { name: 'Stand der Beziehung' });
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Segment und Strategie/ }).textContent).toContain(
        'Segment noch offen',
      ),
    );
    expect(screen.getByRole('link', { name: /Gemeinsamer Plan/ }).textContent).toContain(
      'Noch kein Gemeinsamer Plan',
    );
    // Kennzahlen ohne Daten: ein ruhiger Satz statt Nullen.
    expect(screen.getByRole('complementary', { name: 'Kennzahlen' }).textContent).toContain(
      'Noch keine Kennzahlen',
    );
    // Der Überblick liest nur.
    expect(requests.filter((request) => request.method !== 'GET')).toEqual([]);
  });

  it('Die Seiten im Profil tragen „Intern“ bzw. „nur eure Seite“', async () => {
    const strategyPages: [path: string, title: string][] = [
      ['strategie/profil/bearbeiten', 'Deine Werte bearbeiten'],
      ['strategie/spend', 'Spend'],
      ['strategie/spend/neu', 'Eintrag hinzufügen'],
      ['strategie/spend/0190a0a0-0000-7000-8000-000000002025', 'Eintrag ändern'],
    ];
    for (const [path, title] of strategyPages) {
      renderAgain(`${base}/${path}`);
      const heading = await screen.findByRole('heading', { level: 1, name: title });
      const badge = heading.closest('header')?.querySelector('[data-visibility="internal"]');
      expect(badge?.textContent, path).toBe('Intern');
    }
    renderAgain(`${base}/strategie/profil`);
    const heading = await screen.findByRole('heading', { level: 1, name: 'Profil und Spend' });
    expect(
      heading.closest('header')?.querySelector('[data-visibility="internal"]')?.textContent,
    ).toBe('nur eure Seite');
  });

  it('Profil, Spend und Team liegen hinter „···“; tiefere Seiten haben einen Zurück-Link zur Ebene darüber', async () => {
    const pages = [
      { path: `${base}/strategie/profil`, title: 'Profil und Spend', pill: 'Profil und Spend' },
      { path: `${base}/strategie/spend`, title: 'Spend', pill: 'Profil und Spend' },
      { path: `${base}/beziehung/team`, title: 'Team', pill: 'Team' },
    ];
    for (const page of pages) {
      renderAgain(page.path);
      await screen.findByRole('heading', { level: 1, name: page.title });
      expect(
        within(header())
          .getByRole('link', { name: 'Profil, Segmentierung und Team' })
          .getAttribute('aria-current'),
      ).toBe('page');
      const pills = screen.getByRole('navigation', { name: 'Seiten im Bereich' });
      expect(within(pills).getByRole('link', { current: 'page' }).textContent).toBe(page.pill);
      // Der Kopf zeigt Liste und Lieferant; ein Pfad darunter entfällt.
      expect(screen.queryByRole('navigation', { name: 'Pfad' })).toBeNull();
    }
    // Eine tiefere Seite: „‹ Team“ führt eine Ebene nach oben.
    const router = renderAgain(`${base}/beziehung/team/bearbeiten`);
    await screen.findByRole('list', { name: 'Team' });
    const back = screen
      .getAllByRole('link', { name: 'Team' })
      .find((link) => !link.closest('[data-slot="supplier-header"]')) as HTMLElement;
    fireEvent.click(back);
    await waitFor(() => expect(router.state.location.pathname).toBe(`${base}/beziehung/team`));
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
