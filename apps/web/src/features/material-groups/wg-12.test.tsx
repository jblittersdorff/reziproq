// @vitest-environment jsdom
import type {
  CategoryReview,
  CategoryScorecard,
  StrategyContextResponse,
  StrategyStep,
} from '@reziproq/shared';
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

// Tests zu docs/specs/WG-12.md in der Oberfläche: Scorecard in Schritt 7 nach Fristen gruppiert,
// Warnung bei Hebel ohne Initiative, Formular mit Ziel und Hebel, Fortschritt, Quartals-Review.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
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
const reviewId = uuid(70);
const rel = uuid(80);
let scorecard: CategoryScorecard;
let review: CategoryReview;
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
        'done',
        'done',
        'done',
        'done',
        'in_progress',
        'open',
        'open',
        'open',
      ],
    },
    role: 'lead',
    editableSteps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
};
const content: StrategyStep = {
  step: 7,
  questions: [{ id: uuid(30), view: null, text: 'Wer treibt die Initiative?' }],
  notes: [],
  milestones: [],
  leadSuggestion: null,
  dimensions: [],
  kpis: [],
  goals: [],
};

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sent = [];
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  scorecard = {
    canEdit: true,
    initiatives: [
      {
        id: uuid(40),
        goalId: uuid(20),
        leverChoiceId: uuid(50),
        name: 'Zweite Quelle für Starrflex',
        effect: 'Abhängigkeit unter 50 %',
        actual: 1,
        target: 2,
        ownerUserId: 'anna',
        ownerName: 'Anna Schmidt',
        targetQuarter: 4,
        targetYear: 2027,
        horizon: 'short',
        progress: 30,
        suppliers: [{ relationshipId: rel, name: 'Rheintal Elektronik' }],
        canReport: true,
      },
    ],
    goals: [
      {
        id: uuid(20),
        dimension: 'supply',
        text: 'Zwei Quellen je Technologie',
        kpiName: 'Bestätigte Kapazität',
      },
    ],
    choices: [
      { id: uuid(50), pairing: 'S1 · T1', leverName: 'Neue Lieferanten einführen' },
      { id: uuid(51), pairing: 'W1 · O1', leverName: 'Bedarfe bündeln' },
    ],
    missingChoiceIds: [uuid(51)],
    suppliers: [{ relationshipId: rel, name: 'Rheintal Elektronik' }],
    people: [{ userId: 'anna', name: 'Anna Schmidt' }],
    reviews: [{ id: reviewId, dueOn: '2027-04-10', heldAt: null }],
  };
  review = {
    id: reviewId,
    groupId: group,
    groupName: 'Leiterplatten',
    strategyId,
    year: 2027,
    dueOn: '2027-04-10',
    heldAt: null,
    heldBy: null,
    summary: null,
    canHold: true,
    initiatives: [
      {
        id: uuid(40),
        name: 'Zweite Quelle für Starrflex',
        goal: 'Zwei Quellen je Technologie',
        lever: 'Neue Lieferanten einführen',
        progress: 30,
        actual: 1,
        target: 2,
        ownerName: 'Anna Schmidt',
      },
    ],
    commitments: [
      {
        id: uuid(41),
        supplier: 'Rheintal Elektronik',
        relationshipId: rel,
        title: 'Lieferplan Q1 schicken',
        dueOn: '2027-02-01',
        side: 'supplier',
      },
    ],
    actions: [],
  };
  api.handle = (request) => {
    if (request.url === `/api/warengruppen/${group}/strategie`) return Response.json(context);
    if (request.url.endsWith('/schritte/7')) return Response.json(content);
    if (request.url === `/api/warengruppen/strategien/${strategyId}/scorecard`)
      return Response.json(scorecard);
    if (request.url === `/api/warengruppen/reviews/${reviewId}`) return Response.json(review);
    if (request.method !== 'GET' && request.url.startsWith('/api/warengruppen/')) {
      sent.push(request);
      if (request.url.includes('/reviews/')) {
        review = {
          ...review,
          heldAt: '2027-04-12T09:00:00Z',
          heldBy: 'Anna Schmidt',
          summary: (request.body as { summary: string }).summary,
          canHold: false,
        };
        return Response.json(review);
      }
      return Response.json(scorecard, { status: request.method === 'POST' ? 201 : 200 });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('WG-12 Scorecard und Review', () => {
  it('Schritt 7 gruppiert nach Fristen und nennt Hebel ohne Initiative mit Weg zu Schritt 6', async () => {
    renderAt(`/warengruppen/${group}/strategie/7`);
    expect(await screen.findByRole('heading', { name: 'Kurzfristig (1 Jahr)' })).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Kurzfristig (1 Jahr)' });
    expect(within(table).getByText('Zweite Quelle für Starrflex')).toBeTruthy();
    expect(within(table).getByText('Q4/2027')).toBeTruthy();
    expect(screen.getByText(/Ohne Initiative: W1 · O1 Bedarfe bündeln/)).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Zu den Hebeln (Schritt 6)' }).getAttribute('href'),
    ).toBe(`/warengruppen/${group}/strategie/6`);
    expect(screen.getByRole('link', { name: /Review zum/ }).getAttribute('href')).toBe(
      `/warengruppen/${group}/review/${reviewId}`,
    );
  });

  it('eine neue Initiative schickt Ziel, Hebel, Verantwortung, Termin und Lieferanten', async () => {
    renderAt(`/warengruppen/${group}/strategie/7`);
    fireEvent.click(await screen.findByRole('button', { name: 'Initiative hinzufügen' }));
    const form = screen.getByRole('form', { name: 'Initiative' });
    fireEvent.change(within(form).getByLabelText('Ziel'), { target: { value: uuid(20) } });
    fireEvent.change(within(form).getByLabelText('Gewählter Hebel'), {
      target: { value: uuid(51) },
    });
    fireEvent.change(within(form).getByLabelText('Initiative'), {
      target: { value: 'Bedarfe der BUs bündeln' },
    });
    fireEvent.change(within(form).getByLabelText('Verantwortlich'), { target: { value: 'anna' } });
    fireEvent.change(within(form).getByLabelText('Quartal'), { target: { value: '2' } });
    fireEvent.click(within(form).getByLabelText('Rheintal Elektronik'));
    fireEvent.click(within(form).getByRole('button', { name: 'Initiative speichern' }));
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        method: 'POST',
        url: `/api/warengruppen/strategien/${strategyId}/initiativen`,
        body: {
          goalId: uuid(20),
          leverChoiceId: uuid(51),
          name: 'Bedarfe der BUs bündeln',
          ownerUserId: 'anna',
          targetQuarter: 2,
          targetYear: 2027,
          supplierIds: [rel],
        },
      }),
    );
  });

  it('Fortschritt melden schickt den neuen Wert', async () => {
    renderAt(`/warengruppen/${group}/strategie/7`);
    fireEvent.change(
      await screen.findByLabelText('Fortschritt melden: Zweite Quelle für Starrflex'),
      { target: { value: '60' } },
    );
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        method: 'POST',
        url: `/api/warengruppen/strategien/${strategyId}/initiativen/${uuid(40)}/fortschritt`,
        body: { progress: 60 },
      }),
    );
  });

  it('das Review zeigt Fortschritt, Zusagen der Warengruppe und wird mit Zusammenfassung abgeschlossen', async () => {
    renderAt(`/warengruppen/${group}/review/${reviewId}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: /Quartals-Review zum/ }),
    ).toBeTruthy();
    expect(screen.getByText('Zweite Quelle für Starrflex')).toBeTruthy();
    expect(screen.getByText(/Lieferplan Q1 schicken/)).toBeTruthy();
    expect(screen.getByText('Keine offenen Maßnahmen.')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: /Zusammenfassung/ }), {
      target: { value: 'Zweite Quelle läuft an.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Review abschließen' }));
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        url: `/api/warengruppen/reviews/${reviewId}/abschliessen`,
        body: { summary: 'Zweite Quelle läuft an.' },
      }),
    );
    expect(await screen.findByText(/Abgeschlossen am .* von Anna Schmidt\./)).toBeTruthy();
  });
});
