// @vitest-environment jsdom
import type {
  AwardEligibility,
  AwardPlan,
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
import { awardMonths } from './awards-section';

// Tests zu docs/specs/WG-14.md in der Oberfläche: Vergabeplan in Schritt 8 als Zeitachse, gebündelt,
// Warnung bei Soll „beenden“, nur vergabefähige Lieferanten wählbar, Einstellung für Admins.

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
const rel = { good: uuid(80), weak: uuid(81), leaving: uuid(82) };
const candidate = uuid(83);
let plan: AwardPlan;
let eligibility: AwardEligibility;
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
      supplierCount: 3,
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
        'done',
        'in_progress',
        'open',
        'open',
      ],
    },
    role: 'lead',
    editableSteps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
};
const content: StrategyStep = {
  step: 8,
  questions: [{ id: uuid(30), view: null, text: 'Welche Lieferanten sind geeignet?' }],
  notes: [],
  milestones: [],
  leadSuggestion: null,
  dimensions: [],
  kpis: [],
  goals: [],
};
const awardOf = (n: number, name: string, extra: Partial<AwardPlan['awards'][number]> = {}) => ({
  id: uuid(n),
  name,
  volumeCents: 140_000_000,
  currency: 'EUR',
  requestFrom: '2027-01-10',
  requestTo: '2027-03-20',
  awardDate: '2027-04-15',
  bundleKey: null,
  bundled: false,
  suppliers: [
    { kind: 'relationship' as const, id: rel.good, name: 'Rheintal', note: null, ended: false },
  ],
  endedSuppliers: [],
  ...extra,
});

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sent = [];
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  eligibility = { qualityNotCritical: true, stabilityNotCritical: true };
  plan = {
    canEdit: true,
    strategyYear: 2027,
    awards: [
      awardOf(40, 'Starrflex Antriebe', { bundleKey: 'starrflex', bundled: true }),
      awardOf(41, 'Starrflex Steuerungen', { bundleKey: 'starrflex', bundled: true }),
      awardOf(42, 'Rahmenvertrag Mehrlagen', {
        suppliers: [
          { kind: 'relationship', id: rel.good, name: 'Rheintal', note: null, ended: false },
          { kind: 'relationship', id: rel.leaving, name: 'Saar Circuits', note: null, ended: true },
        ],
        endedSuppliers: ['Saar Circuits'],
      }),
    ],
    options: [
      {
        kind: 'relationship',
        id: rel.good,
        name: 'Rheintal',
        eligible: true,
        reasons: [],
        ended: false,
      },
      {
        kind: 'relationship',
        id: rel.weak,
        name: 'Donau Print',
        eligible: false,
        reasons: ['quality_critical'],
        ended: false,
      },
      {
        kind: 'relationship',
        id: rel.leaving,
        name: 'Saar Circuits',
        eligible: true,
        reasons: [],
        ended: true,
      },
      {
        kind: 'candidate',
        id: candidate,
        name: 'Laminat Nord',
        eligible: true,
        reasons: [],
        ended: false,
      },
    ],
    eligibility,
    complete: true,
  };
  api.handle = (request) => {
    if (request.url === `/api/warengruppen/${group}/strategie`) return Response.json(context);
    if (request.url.endsWith('/schritte/8')) return Response.json(content);
    if (request.url === `/api/warengruppen/strategien/${strategyId}/vergaben`) {
      if (request.method === 'GET') return Response.json(plan);
      sent.push(request);
      return Response.json(plan, { status: 201 });
    }
    if (request.url === '/api/warengruppen/vergabefaehigkeit') {
      if (request.method === 'PUT') {
        sent.push(request);
        eligibility = request.body as AwardEligibility;
      }
      return Response.json(eligibility);
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('WG-14 Vergabeplan', () => {
  it('zeigt die Vergaben als Zeitachse, gebündelt und mit Warnung bei Soll „beenden“', async () => {
    renderAt(`/warengruppen/${group}/strategie/8`);
    const table = await screen.findByRole('table', { name: 'Projekt- und Vergabeplan' });
    const rows = within(table).getAllByRole('row');
    expect(rows.map((row) => row.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Starrflex Antriebe.*gebündelt.*Rheintal · 1,4\sMio\.\s€/),
        expect.stringMatching(/Rahmenvertrag Mehrlagen.*Rheintal, Saar Circuits/),
      ]),
    );
    expect(within(table).getAllByText('gebündelt')).toHaveLength(2);
    expect(
      screen.getByText(/Rahmenvertrag Mehrlagen: Saar Circuits soll laut Supplier Map beendet/),
    ).toBeTruthy();
    expect(within(table).getAllByText(/Vergabedatum: /).length).toBe(3);
  });

  it('nur vergabefähige Lieferanten sind wählbar; die anderen stehen mit Grund darunter', async () => {
    renderAt(`/warengruppen/${group}/strategie/8`);
    fireEvent.click(await screen.findByRole('button', { name: 'Vergabe hinzufügen' }));
    const form = screen.getByRole('form', { name: 'Neue Vergabe' });
    expect(within(form).queryByLabelText(/^Donau Print/)).toBeNull();
    expect(
      within(form).getByText('Donau Print (nicht vergabefähig: Qualitätsbewertung C)'),
    ).toBeTruthy();
    expect(within(form).getByLabelText('Laminat Nord · Kandidat')).toBeTruthy();
    expect(
      within(form).getByLabelText('Saar Circuits · Soll laut Supplier Map: beenden'),
    ).toBeTruthy();
    fireEvent.change(within(form).getByLabelText('Vergabe'), {
      target: { value: 'Laminat direkt' },
    });
    fireEvent.change(within(form).getByLabelText('Volumen in Euro'), {
      target: { value: '900000' },
    });
    fireEvent.change(within(form).getByLabelText('Vergabedatum'), {
      target: { value: '2027-06-30' },
    });
    fireEvent.click(within(form).getByLabelText('Laminat Nord · Kandidat'));
    fireEvent.click(within(form).getByRole('button', { name: 'Vergabe speichern' }));
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        method: 'POST',
        url: `/api/warengruppen/strategien/${strategyId}/vergaben`,
        body: {
          name: 'Laminat direkt',
          volumeCents: 90_000_000,
          awardDate: '2027-06-30',
          suppliers: [{ kind: 'candidate', id: candidate, note: null }],
        },
      }),
    );
  });

  it('die Zeitachse umfasst mindestens sechs Monate', () => {
    expect(awardMonths([], '2027-02-15')).toEqual({ start: { year: 2027, month: 1 }, count: 6 });
    expect(awardMonths(plan.awards, '2026-12-01')).toEqual({
      start: { year: 2026, month: 11 },
      count: 6,
    });
    expect(
      awardMonths([awardOf(43, 'Spät', { awardDate: '2027-12-01' })], '2027-01-05').count,
    ).toBe(12);
  });

  it('Admins stellen die Vergabefähigkeit ein', async () => {
    api.me = { ...anna, orgRole: 'admin' };
    api.permissions = actionsFor.admin;
    renderAt('/einstellungen/warengruppen/vergabe');
    expect(await screen.findByRole('heading', { level: 1, name: 'Vergabefähigkeit' })).toBeTruthy();
    // Die Rechte laden nach der Seite; erst dann gibt es den Knopf
    const save = await screen.findByRole('button', { name: 'Speichern' });
    fireEvent.click(screen.getByRole('switch', { name: /Qualitätsbewertung C/ }));
    fireEvent.click(save);
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        method: 'PUT',
        url: '/api/warengruppen/vergabefaehigkeit',
        body: { qualityNotCritical: false, stabilityNotCritical: true },
      }),
    );
  });
});
