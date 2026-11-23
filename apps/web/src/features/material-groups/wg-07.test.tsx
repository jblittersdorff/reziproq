// @vitest-environment jsdom
import type { AnalysisStep, StrategyContextResponse, StrategyStep } from '@reziproq/shared';
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

// Tests zu docs/specs/WG-07.md in der Oberfläche: Umschalter der Sichten mit Stand, Ergebnis aus
// dem Spend, Hinweis zum Kartellrecht, Kurzfassung der anderen Sichten, Pflege der Eingaben und
// „Als Lieferant anlegen“.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const uuid = (n: number) => `0190a0a0-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
const group = uuid(10);
const strategyId = uuid(60);
let analysis: AnalysisStep;
let sent: { method: string; url: string; body: unknown }[];

const context: StrategyContextResponse = {
  year: 2027,
  hidden: false,
  canCreate: false,
  context: {
    group: {
      id: group,
      name: 'Leiterplatten',
      code: 'LP',
      lead: { userId: 'anna', name: 'Anna Schmidt' },
      spend: null,
      supplierCount: 2,
    },
    strategy: {
      id: strategyId,
      year: 2027,
      status: 'draft',
      version: 1,
      steps: [
        'done',
        'done',
        'in_progress',
        'open',
        'open',
        'open',
        'open',
        'open',
        'open',
        'open',
      ],
    },
    role: 'lead',
    editableSteps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
};
const stepContent = (step: number): StrategyStep => ({
  step,
  questions: [
    { id: uuid(30), view: 'Volumen', text: 'Welche Produktgruppen machen den größten Umsatz aus?' },
    { id: uuid(31), view: 'Kosten', text: 'Welche Kosten dominieren die Kostenstruktur?' },
  ],
  notes: [],
  milestones: [],
  leadSuggestion: null,
  dimensions: [],
  kpis: [],
  goals: [],
});
const share = (key: string, name: string, value: number) => ({
  key,
  name,
  amountCents: value * 1_000_000,
  share: value / 100,
});

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sent = [];
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  analysis = {
    step: 3,
    canEdit: true,
    canAssign: false,
    functionMembers: [],
    views: [
      {
        view: 'volume',
        state: 'in_progress',
        data: { minRequirements: ['Temperaturfest bis 150 °C'], differentiators: [], forecast: [] },
        updatedAt: null,
        assignees: [],
        comments: [],
        canComment: false,
      },
      {
        view: 'supply_chain',
        state: 'done',
        data: { stages: [{ name: 'Laminat', description: '', valueSharePct: 30 }], countries: [] },
        updatedAt: null,
        assignees: [],
        comments: [],
        canComment: false,
      },
      {
        view: 'cost',
        state: 'done',
        data: { costTypes: [{ name: 'Material', own: 100, target: 98.5, market: 91 }] },
        updatedAt: null,
        assignees: [],
        comments: [],
        canComment: false,
      },
      { view: 'technology', state: 'open', data: { technologies: [] }, updatedAt: null, assignees: [], comments: [], canComment: false },
    ],
    computed: {
      currency: 'EUR',
      spendYear: 2025,
      years: [2023, 2024, 2025],
      productGroups: [
        share(uuid(20), 'Mehrlagen', 46),
        share(uuid(21), 'Starrflex', 22),
        share(uuid(22), 'HDI', 15),
      ],
      productGroupRestShare: 0.17,
      byBusinessUnit: [],
      bySegment: [],
      topSuppliers: [],
      byStability: [],
      byQualityRating: [],
      bySupplierCountry: [share('DE', 'DE', 65), share('CZ', 'CZ', 35)],
    },
    suppliers: [{ relationshipId: uuid(40), name: 'Rheintal Elektronik' }],
    businessUnits: [],
    candidates: [],
    round: { exists: false, decided: false },
  };
  api.handle = (request) => {
    if (request.url === `/api/warengruppen/${group}/strategie`) return Response.json(context);
    if (request.url === `/api/warengruppen/${group}/segmentierung`) {
      return Response.json({
        group: { id: group, name: 'Leiterplatten' },
        spendYear: 2025,
        canManage: true,
        round: null,
        types: [],
        raters: [],
        suppliers: [],
      });
    }
    const stepMatch = request.url.match(/\/schritte\/(\d+)$/);
    if (stepMatch) return Response.json(stepContent(Number(stepMatch[1])));
    if (request.url.match(/\/schritte\/\d+\/analysen$/)) return Response.json(analysis);
    if (
      request.method !== 'GET' &&
      request.url.startsWith(`/api/warengruppen/strategien/${strategyId}/`)
    ) {
      sent.push(request);
      if (request.url.endsWith('/lieferant')) {
        return Response.json({ relationshipId: uuid(90), step: analysis }, { status: 201 });
      }
      return Response.json(analysis);
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('WG-07 Analysen', () => {
  it('Umschalter mit Stand je Sicht, Volumen aus dem Spend, andere Sichten als Kurzfassung', async () => {
    renderAt(`/warengruppen/${group}/strategie/3`);
    const views = await screen.findByRole('group', { name: 'Sicht' });
    expect(within(views).getByRole('radio', { name: 'Volumen, in Arbeit' })).toBeTruthy();
    expect(within(views).getByRole('radio', { name: 'Technologie, offen' })).toBeTruthy();
    expect(screen.getByText('Umsatzanteil der Produktgruppen 2025')).toBeTruthy();
    expect(screen.getByText('Mehrlagen')).toBeTruthy();
    expect(screen.getByText('Weitere')).toBeTruthy();
    expect(screen.getByText('Temperaturfest bis 150 °C')).toBeTruthy();
    expect(screen.getByText('Welche Produktgruppen machen den größten Umsatz aus?')).toBeTruthy();
    // Kurzfassung der anderen Sichten
    const others = screen.getByRole('region', { name: 'Die anderen 3 Sichten' });
    expect(within(others).getByText('Laminat 30 %')).toBeTruthy();
    expect(
      within(others).getByText('Index: ihr 100, Soll-Kalkulation 98,5, Markt 91'),
    ).toBeTruthy();
  });

  it('die Kostensicht zeigt dauerhaft den Hinweis zum Kartellrecht', async () => {
    renderAt(`/warengruppen/${group}/strategie/3`);
    fireEvent.click(await screen.findByRole('radio', { name: 'Kosten, fertig' }));
    expect(
      await screen.findByText(/Kartellrecht: Kosten nie einem einzelnen Lieferanten zuordnen/),
    ).toBeTruthy();
    expect(screen.getByText('Welche Kosten dominieren die Kostenstruktur?')).toBeTruthy();
  });

  it('das Team pflegt die Eingaben einer Sicht; Umsatzwerte sind nicht eingebbar', async () => {
    renderAt(`/warengruppen/${group}/strategie/3`);
    fireEvent.click(await screen.findByRole('button', { name: 'Bearbeiten: Volumen' }));
    const form = screen.getByRole('form', { name: 'Bearbeiten: Volumen' });
    const differentiators = within(form).getByRole('group', { name: 'Was euch unterscheidet' });
    fireEvent.click(within(differentiators).getByRole('button', { name: 'Hinzufügen' }));
    fireEvent.change(within(differentiators).getByLabelText('Eintrag'), {
      target: { value: 'Starrflex spart Stecker' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        method: 'PUT',
        url: `/api/warengruppen/strategien/${strategyId}/analysen/volume`,
        body: {
          data: {
            minRequirements: ['Temperaturfest bis 150 °C'],
            differentiators: ['Starrflex spart Stecker'],
            forecast: [],
          },
        },
      }),
    );
  });

  it('ohne Kostensicht (außerhalb des Teams) fehlt sie im Umschalter', async () => {
    analysis = {
      ...analysis,
      canEdit: false,
      views: analysis.views.filter((view) => view.view !== 'cost'),
    };
    renderAt(`/warengruppen/${group}/strategie/3`);
    const views = await screen.findByRole('group', { name: 'Sicht' });
    expect(within(views).queryByRole('radio', { name: /Kosten/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Bearbeiten/ })).toBeNull();
  });

  it('Footprint: ein weiterer Lieferant wird mit einem Klick als Lieferant angelegt', async () => {
    analysis = {
      ...analysis,
      step: 4,
      views: [
        {
          view: 'revenue_finance',
          state: 'open',
          data: { stability: [], callOff: [] },
          updatedAt: null,
          assignees: [],
          comments: [],
          canComment: false,
        },
        {
          view: 'quality',
          state: 'open',
          data: { ratings: [], defects: [], audits: [] },
          updatedAt: null,
          assignees: [],
          comments: [],
          canComment: false,
        },
        { view: 'footprint', state: 'open', data: { recipients: [] }, updatedAt: null, assignees: [], comments: [], canComment: false },
      ],
      candidates: [
        {
          id: uuid(70),
          name: 'Brno PCB',
          site: 'Brno',
          country: 'CZ',
          revenueCents: null,
          currency: 'EUR',
          isSupplier: false,
          comment: null,
        },
      ],
    };
    renderAt(`/warengruppen/${group}/strategie/4`);
    expect(await screen.findByText(/Bewertungsrunde der Warengruppe: noch keine/)).toBeTruthy();
    fireEvent.click(await screen.findByRole('radio', { name: 'Footprint, offen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Als Lieferant anlegen: Brno PCB' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        method: 'POST',
        url: `/api/warengruppen/strategien/${strategyId}/kandidaten/${uuid(70)}/lieferant`,
      }),
    );
    expect(await screen.findByText('Lieferant im Entwurf angelegt.')).toBeTruthy();
  });
  it('Schritt 24: Lead weist eine Sicht der Funktion zu; zugewiesene Personen kommentieren', async () => {
    analysis = {
      ...analysis,
      canAssign: true,
      functionMembers: [{ userId: 'kim', name: 'Kim Qualität' }],
      views: analysis.views.map((entry) =>
        entry.view === 'volume'
          ? {
              ...entry,
              canComment: true,
              comments: [
                {
                  id: uuid(70),
                  authorName: 'Kim Qualität',
                  body: 'Prüftechnik fehlt.',
                  createdAt: '2026-11-20T10:00:00Z',
                  own: false,
                },
              ],
            }
          : entry,
      ),
    };
    renderAt(`/warengruppen/${group}/strategie/3`);
    const panel = await screen.findByRole('region', { name: 'Team und Kommentare' });
    expect(within(panel).getByText('Noch niemandem zum Kommentieren zugewiesen.')).toBeTruthy();
    expect(within(panel).getByText('Prüftechnik fehlt.')).toBeTruthy();
    fireEvent.click(within(panel).getByLabelText('Kim Qualität'));
    fireEvent.click(within(panel).getByRole('button', { name: 'Zuweisung speichern' }));
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        method: 'PUT',
        url: `/api/warengruppen/strategien/${strategyId}/analysen/volume/zuweisung`,
        body: { userIds: ['kim'] },
      }),
    );
    fireEvent.change(within(panel).getByLabelText('Dein Kommentar'), {
      target: { value: 'Ergänze ich bis Freitag.' },
    });
    fireEvent.click(within(panel).getByRole('button', { name: 'Kommentieren' }));
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        method: 'POST',
        url: `/api/warengruppen/strategien/${strategyId}/analysen/volume/kommentare`,
        body: { body: 'Ergänze ich bis Freitag.' },
      }),
    );
  });
});
