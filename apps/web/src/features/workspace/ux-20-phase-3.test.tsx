// @vitest-environment jsdom
import type {
  Kpi,
  RelationshipRow,
  ScorecardView,
  SupplierCycle,
  SupplierDetail,
  SupplierOverview,
  TouchpointList,
} from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  actionsFor,
  api,
  renderAt,
  sampleRelationships,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';
import { spendOverviewOf } from '@/testing/spend';

// UX-20 Phase 3 (NAV-10 1.1): Lieferantenliste (seit BZ-01 mit Filter-Chips), Überblick des
// Lieferanten, Profil und Spend. Höchstens eine Karte „Als Nächstes“, außerhalb kein Hauptknopf.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const rel = (n: number) => `0190a0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const today = new Date().toISOString().slice(0, 10);
const inDays = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Hauptknöpfe außerhalb der Karte „Als Nächstes“ (NAV-10 Seitenregel 3) */
const primaryOutsideNext = () =>
  [...document.querySelectorAll('.bg-primary')].filter(
    (element) => !element.closest('[data-slot="next-card"]'),
  );

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
});

afterEach(tearDownApp);

// BZ-01 (K2-b.4): Die Gruppen „Brauchen dich“ und „Laufen gut“ und der Ampelpunkt sind gestrichen.
// Der wichtigste Grund steht als Text in der grauen Zeile; die Reihenfolge ist die Aufmerksamkeit.
describe('Lieferantenliste (NAV-10 1.1, BZ-01)', () => {
  const line = (n: number, extra: Partial<RelationshipRow> = {}): RelationshipRow => ({
    ...(sampleRelationships.rows[3] as RelationshipRow),
    relationshipId: rel(n),
    name: `Lieferant ${n}`,
    reason: null,
    attention: 0,
    segment: null,
    ...extra,
  });
  beforeEach(() => {
    api.relationships = {
      status: 200,
      body: {
        ...sampleRelationships,
        rows: [
          line(2, {
            reason: { kind: 'overdue', count: 1, title: 'Musterteile bestätigen' },
            attention: 5,
            isMine: true,
          }),
          line(3, {
            reason: {
              kind: 'hint',
              hint: {
                id: rel(50),
                ruleKey: 'performance_drop',
                severity: 'medium',
                status: 'open',
                title: null,
                metric: null,
                value: null,
              },
            },
            attention: 3,
          }),
          line(1, { isFocus: true }),
          line(4, { isFocus: true, isMine: true }),
        ],
      },
      drafts: [],
      ended: [],
    };
  });

  const names = () =>
    [
      ...(document
        .querySelector('[data-slot="relationship-rows"]')
        ?.querySelectorAll('a[href^="/beziehungen/"] b') ?? []),
    ].map((name) => name.firstChild?.textContent?.trim());

  it('Grund als Text in der grauen Zeile, ohne Ampelpunkt und ohne Gruppen', async () => {
    renderAt('/lieferanten');
    await screen.findByRole('group', { name: 'Filter' });
    expect(names()).toEqual(['Lieferant 2', 'Lieferant 3', 'Lieferant 1', 'Lieferant 4']);
    const list = document.querySelector('[data-slot="relationship-rows"]') as HTMLElement;
    const [second, third] = within(list).getAllByRole('link');
    expect(second?.textContent).toContain('1 Zusage überfällig');
    // Ein Hinweis ohne Kennzahl trägt den Namen seiner Regel, nie den Schlüssel
    expect(third?.textContent).toContain('Leistung kippt');
    expect(third?.textContent).not.toContain('performance_drop');
    expect(document.querySelector('[data-slot="status-dot"]')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Brauchen dich' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Laufen gut' })).toBeNull();
    expect(primaryOutsideNext()).toEqual([]);
  });

  it('Filter-Chips Meine, Strategisch, Alle stehen in der Adresse', async () => {
    const router = renderAt('/lieferanten');
    const chips = await screen.findByRole('group', { name: 'Filter' });
    expect(within(chips).getByRole('button', { name: /^Alle/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(within(chips).getByRole('button', { name: /^Meine/ }));
    await waitFor(() => expect(router.state.location.search).toMatchObject({ filter: 'meine' }));
    await waitFor(() => expect(names()).toEqual(['Lieferant 2', 'Lieferant 4']));
    fireEvent.click(within(chips).getByRole('button', { name: /^Strategisch/ }));
    await waitFor(() => expect(router.state.location.search).toEqual({ filter: 'strategisch' }));
    await waitFor(() => expect(names()).toEqual(['Lieferant 1', 'Lieferant 4']));
    fireEvent.click(within(chips).getByRole('button', { name: /^Alle/ }));
    await waitFor(() => expect(router.state.location.search).toEqual({}));
  });
});

describe('Überblick des Lieferanten (NAV-10 1.1)', () => {
  const id = rel(1);
  const base = `/lieferanten/${id}`;
  const detail: SupplierDetail = {
    relationshipId: id,
    name: 'Rheintal Elektronik',
    organizationName: 'Rheintal Elektronik GmbH',
    country: 'DE',
    vatId: 'DE123456789',
    duns: null,
    externalRef: 'K-10442',
    notes: null,
    status: 'active',
    createdAt: '2026-10-01T08:00:00Z',
    endedAt: null,
    spend: [{ year: 2025, amount: { amountCents: 420_000_000, currency: 'EUR' } }],
    permissions: { edit: true, editTeam: true },
    isFocus: true,
    materialGroups: ['Leiterplatten', 'Baugruppen'],
  };
  const cycle: SupplierCycle = {
    id: rel(99),
    label: '2026',
    startedAt: '2026-01-01T00:00:00.000Z',
    jbpDate: null,
    schedule: (['feedback', 'touchpoints', 'supplierPlan', 'jbp', 'scorecard'] as const).map(
      (step, index) => ({
        step,
        weeksRelativeToJbp: index - 3,
        reminderDaysBefore: 7,
        dueDate: null,
      }),
    ),
    steps: (
      [
        'segment',
        'feedback',
        'touchpoints',
        'supplierPlan',
        'jbp',
        'scorecard',
        'execution',
      ] as const
    ).map((key, index) => ({
      key,
      status: index < 2 ? 'completed' : 'open',
      href: `${base}/schritt/${key}`,
      dueDate: null,
    })),
  };
  let overview: SupplierOverview;
  let next: unknown;
  const kpi = (name: string, values: string[], target: string, track: Kpi['track']): Kpi => ({
    id: name === 'Liefertreue' ? rel(70) : rel(71),
    own: true,
    ownerSide: 'buyer',
    initiative: null,
    name,
    unit: '%',
    direction: 'higher',
    baseline: '90',
    target,
    targetDate: '2026-12-31',
    ownerUserId: null,
    ownerName: 'Sara Ost',
    benefitFor: 'both',
    startDate: '2026-01-01',
    values: values.map((value, index) => ({ period: `2026-0${index + 1}-01`, value })),
    track,
    canEnter: true,
  });

  beforeEach(() => {
    next = null;
    overview = {
      head: {
        segment: { current: 'Entwickeln', target: 'Strategisch' },
        sro: null,
        nextMeeting: null,
        isFocus: true,
      },
      metrics: [
        {
          tile: 'plan',
          kind: 'jbp',
          status: 'draft',
          meetingDate: null,
          topics: 4,
          initiatives: 2,
        },
      ],
      cycle,
      canStartCycle: true,
      canSetJbpDate: true,
      overdueCommitments: 1,
      openDrafts: 3,
      openConflicts: 1,
      figures: {
        spend: {
          year: 2025,
          amount: { amountCents: 420_000_000, currency: 'EUR' },
          changeBasisPoints: 800,
        },
        groupShare: { group: 'Leiterplatten', year: 2025, basisPoints: 3_800 },
        feedbackGap: { dimension: 'transparency', delta: -0.9 },
      },
    };
    const scorecard: ScorecardView = {
      hasPlan: true,
      ownSide: 'buyer',
      status: 'signed',
      version: 2,
      kpis: [
        kpi('Liefertreue', ['92', '94'], '97', 'close'),
        kpi('Qualität', ['96', '98'], '97', 'on_track'),
      ],
      signatures: [],
      deadline: null,
      tolerancePercent: 10,
      canEdit: false,
      canSign: false,
      canNewVersion: false,
      people: [],
      initiatives: [],
    };
    const touchpoints: TouchpointList = {
      touchpoints: [
        {
          id: rel(50),
          visibility: 'shared',
          buyerUserId: 'sara',
          buyerName: 'Sara Ost',
          buyerLevel: 'management',
          supplierContactId: rel(60),
          supplierName: 'Tom Weber',
          supplierLevel: 'management',
          format: 'QBR',
          cadence: 'quarterly',
          notes: null,
        },
      ],
      gaps: [
        {
          title: { de: 'Geschäftsleitung trifft Geschäftsleitung', en: 'Executive meeting' },
          level: 'executive',
        },
      ],
      formats: [],
      people: [],
      contacts: [],
      canEdit: true,
      review: null,
      canReview: false,
    };
    api.handle = (request) => {
      if (request.url === `/api/suppliers/${id}`) return Response.json(detail);
      if (request.url === `/api/suppliers/${id}/overview`) return Response.json(overview);
      if (request.url === `/api/suppliers/${id}/spend`)
        return Response.json(spendOverviewOf(detail));
      if (request.url === `/api/suppliers/${id}/jbp/scorecard`) return Response.json(scorecard);
      if (request.url === `/api/suppliers/${id}/kontaktpunkte`) return Response.json(touchpoints);
      if (request.url === `/api/suppliers/${id}/contacts`) {
        return Response.json([
          {
            id: rel(60),
            relationshipId: id,
            name: 'Tom Weber',
            email: 'tom@rheintal.example',
            function: 'Vertrieb',
            position: 'Key Account',
          },
        ]);
      }
      if (request.url === `/api/start/als-naechstes?beziehung=${id}`) {
        return Response.json({ next });
      }
      if (request.url.startsWith(`/api/start/termine?tage=42&beziehung=${id}`)) {
        return Response.json({
          from: today,
          to: inDays(41),
          items: [
            {
              id: 'm1',
              date: inDays(9),
              kind: 'meeting',
              source: 'meeting',
              title: 'JBP Rheintal',
              counterpart: 'Rheintal Elektronik',
              detail: null,
              startsAt: `${inDays(9)}T09:00:00.000Z`,
              progress: null,
              href: `${base}/umsetzung/termine/m1`,
              relationshipId: id,
              categoryId: null,
            },
          ],
        });
      }
      if (request.url.startsWith('/api/audit')) return Response.json({ entries: [] });
      return undefined;
    };
  });

  it('ohne Aufgabe führt „Als Nächstes“ zum JBP-Termin; eine Karte, kein Hauptknopf daneben', async () => {
    renderAt(base);
    const card = await waitFor(
      () => {
        const found = document.querySelector<HTMLElement>('[data-slot="next-card"]');
        expect(found).not.toBeNull();
        return found as HTMLElement;
      },
      { timeout: 3000 },
    );
    expect(within(card).getByRole('link', { name: 'Termin festlegen' }).getAttribute('href')).toBe(
      `${base}/zyklus/termin`,
    );
    expect(document.querySelectorAll('[data-slot="next-card"]')).toHaveLength(1);
    // Vier Phasen: Segment erledigt, Plan jetzt
    const chain = screen.getByRole('navigation', { name: 'Jahreszyklus 2026' });
    expect(
      within(chain)
        .getAllByRole('listitem')
        .map((item) => item.getAttribute('data-state')),
    ).toEqual(['done', 'current', 'open', 'open']);
    // Kopf: Fokus, Segment, Warengruppe und Schritt
    const header = document.querySelector('[data-slot="supplier-header"]') as HTMLElement;
    expect(header.textContent).toContain(
      'Fokuslieferant · Entwickeln · Leiterplatten · Schritt 3 von 7: Kontaktpunkte',
    );
    expect(primaryOutsideNext()).toEqual([]);
  });

  it('eine fällige Aufgabe bei diesem Lieferanten geht dem Zyklus vor', async () => {
    next = {
      scope: 'relationship',
      item: {
        id: 'a1',
        kind: 'action',
        supplier: 'Rheintal Elektronik',
        detail: null,
        dueDate: inDays(-2),
        href: `${base}/umsetzung/massnahmen/a1`,
      },
      overdueDays: 2,
      minutes: 10,
    };
    renderAt(base);
    await waitFor(
      () =>
        expect(document.querySelector('[data-slot="next-card"]')?.getAttribute('data-href')).toBe(
          `${base}/umsetzung/massnahmen/a1`,
        ),
      { timeout: 3000 },
    );
    const card = document.querySelector('[data-slot="next-card"]') as HTMLElement;
    expect(card.textContent).toContain('überfällig seit 2 Tagen');
    expect(document.querySelectorAll('[data-slot="next-card"]')).toHaveLength(1);
    expect(within(card).queryByRole('link', { name: 'Termin festlegen' })).toBeNull();
  });

  it('Zeilen mit Stand-Chip, Leistung, Kennzahlen, Termine und Kontakte aus ihren Quellen', async () => {
    renderAt(base);
    const rows = await screen.findByRole(
      'region',
      { name: 'Stand der Beziehung' },
      { timeout: 3000 },
    );
    const plan = within(rows).getByRole('link', { name: /Gemeinsamer Plan/ });
    expect(plan.textContent).toContain('4 Themen, 2 Initiativen');
    expect(plan.textContent).toContain('1 überfällig');
    expect(within(rows).getByRole('link', { name: /Aktivitäten/ }).textContent).toContain(
      '3 zu prüfen',
    );
    const strategy = within(rows).getByRole('link', { name: /Segment und Strategie/ });
    expect(strategy.textContent).toContain('Ist Entwickeln → Soll Strategisch · 1 Widerspruch');

    const performance = await screen.findByRole(
      'heading',
      { name: '1 von 2 Kennzahlen auf Kurs' },
      { timeout: 3000 },
    );
    const card = performance.closest('section') as HTMLElement;
    expect(card.textContent).toContain('94 % · Ziel 97 · knapp');
    expect(within(card).getByRole('link', { name: 'Zur Scorecard' }).getAttribute('href')).toBe(
      `${base}/plan/scorecard`,
    );

    const aside = screen.getByRole('complementary', { name: 'Kennzahlen' });
    // Prozente mit geschütztem Leerzeichen wie Intl
    await waitFor(() => expect(aside.textContent).toMatch(/\+8\s%\szum Vorjahr/));
    expect(aside.textContent).toMatch(/38\s%/);
    expect(aside.textContent).toContain('der Warengruppe Leiterplatten');
    expect(aside.textContent).toContain('Lücke Transparenz im Feedback');
    // EBIT und Cash werden nie addiert: Spend und Ergebnis stehen in eigenen Karten.
    const meeting = await within(aside).findByRole('link', { name: /JBP Rheintal/ });
    expect(meeting.getAttribute('href')).toBe(`${base}/umsetzung/termine/m1`);
    const contacts = await within(aside).findByRole('heading', {
      name: 'Kontakte bei Rheintal Elektronik',
    });
    const contactCard = contacts.closest('section') as HTMLElement;
    expect(contactCard.textContent).toContain('Tom Weber');
    expect(contactCard.textContent).toContain('quartalsweise');
    expect(contactCard.textContent).toContain('Geschäftsleitung trifft Geschäftsleitung');
    expect(contactCard.textContent).toContain('Lücke');
  });

  it('Profil und Spend: nur eure Seite, Das Wichtigste, Stammdaten, Kontakte, Spend je Jahr', async () => {
    renderAt(`${base}/strategie/profil`);
    const title = await screen.findByRole('heading', { level: 1, name: 'Profil und Spend' });
    expect(title.closest('header')?.textContent).toContain('nur eure Seite');
    expect(screen.getByRole('link', { name: 'Profil bearbeiten' }).getAttribute('href')).toBe(
      `${base}/strategie/profil/bearbeiten`,
    );
    await waitFor(() =>
      expect(screen.getByRole('link', { name: /Lücke.*Transparenz/ }).getAttribute('href')).toBe(
        `${base}/beziehung/feedback`,
      ),
    );
    const master = screen.getByRole('region', { name: 'Stammdaten' });
    expect(master.textContent).toContain('Leiterplatten (Haupt) · Baugruppen');
    expect(master.textContent).toContain('DE123456789');
    const contacts = screen.getByRole('region', { name: 'Kontakte' });
    expect(await within(contacts).findByText('Tom Weber')).toBeTruthy();
    expect(contacts.textContent).toContain('Key Account · tom@rheintal.example');
    expect(await screen.findByRole('list', { name: 'Spend je Jahr' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Alle Einträge' }).getAttribute('href')).toBe(
      `${base}/strategie/spend`,
    );
    expect(primaryOutsideNext()).toEqual([]);
  });
});
