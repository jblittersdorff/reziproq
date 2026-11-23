// @vitest-environment jsdom
import type {
  MaterialGroupDetail,
  StrategyContextResponse,
  StrategyOverview,
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

// Tests zu docs/specs/WG-04.md und WG-06.md in der Oberfläche: Übersicht mit nächster Aufgabe und
// zehn Ringen, Ablauf-Leiste mit Stand aus den Daten und frei anspringbaren Schritten, Ziele mit
// Kennzahl und begründetem Zurückstellen, Lesen ohne Bearbeiten.

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
const label = { singular: 'Warengruppe', plural: 'Warengruppen' };
const states = [
  'done',
  'in_progress',
  'open',
  'open',
  'open',
  'open',
  'open',
  'open',
  'open',
  'open',
] as const;
const groupHead = {
  id: group,
  name: 'Leiterplatten',
  code: 'LP',
  lead: { userId: 'anna', name: 'Anna Schmidt' },
  spend: { amountCents: 820_000_000, currency: 'EUR', year: 2025 },
  supplierCount: 7,
};
let context: StrategyContextResponse;
let step2: StrategyStep;
let sent: { method: string; url: string; body: unknown }[];

const overview: StrategyOverview = {
  year: 2027,
  next: { materialGroupId: group, name: 'Leiterplatten', step: 2, strategyId },
  approvedCount: 1,
  groups: [
    {
      ...groupHead,
      strategy: { id: strategyId, year: 2027, status: 'draft', version: 1, steps: [...states] },
      hidden: false,
      canCreate: false,
    },
    {
      id: uuid(11),
      name: 'Gussteile',
      code: 'GU',
      lead: null,
      spend: null,
      supplierCount: 4,
      strategy: null,
      hidden: false,
      canCreate: false,
    },
  ],
};
const detail: MaterialGroupDetail = {
  label,
  group: {
    id: group,
    name: 'Leiterplatten',
    code: 'LP',
    description: null,
    active: true,
    lead: { userId: 'anna', name: 'Anna Schmidt' },
    commodityManager: null,
  },
  parent: null,
  children: [],
  productGroups: [{ id: uuid(20), name: 'Mehrlagen', description: null, position: 1 }],
  members: [],
  suppliers: [],
  canEdit: true,
  people: [],
  businessUnits: [],
};
const kpi = (n: number, dimension: string, name: string, unit: string | null = '%') => ({
  id: uuid(n),
  dimension,
  name,
  description: null,
  unit,
  source: null,
  active: true,
});

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sent = [];
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  context = {
    year: 2027,
    hidden: false,
    canCreate: false,
    context: {
      group: groupHead,
      strategy: { id: strategyId, year: 2027, status: 'draft', version: 1, steps: [...states] },
      role: 'lead',
      editableSteps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    },
  };
  step2 = {
    step: 2,
    questions: [{ id: uuid(30), view: null, text: 'Welche übergeordnete Strategie gilt?' }],
    notes: [],
    milestones: [],
    leadSuggestion: null,
    dimensions: [
      { key: 'supply', name: 'Versorgung' },
      { key: 'quality', name: 'Qualität' },
      { key: 'cost', name: 'Kosten' },
      { key: 'technology', name: 'Technologie' },
      { key: 'sustainability', name: 'Nachhaltigkeit' },
    ],
    kpis: [
      kpi(40, 'supply', 'Bestätigte Kapazität'),
      kpi(41, 'sustainability', 'CO₂-Fußabdruck', 't'),
    ],
    goals: [
      {
        id: uuid(50),
        kpiId: uuid(40),
        dimension: 'supply',
        text: 'Kapazität für den Anlauf 2028 absichern',
        actual: 82,
        actualSource: 'manual',
        actualAsOf: null,
        targetNextYear: 90,
        targetFinal: 100,
        targetQuarter: 4,
        targetYear: 2028,
        deferred: false,
        deferredReason: null,
      },
    ],
  };
  api.handle = (request) => {
    if (request.url === '/api/warengruppen/strategien') return Response.json(overview);
    if (request.url === '/api/warengruppen') {
      return Response.json({ label, groups: [], unassignedSpendRows: 0, canManage: false });
    }
    if (request.url === `/api/warengruppen/${group}/strategie`) return Response.json(context);
    if (request.url === `/api/warengruppen/${group}`) return Response.json(detail);
    const stepMatch = request.url.match(/\/schritte\/(\d+)$/);
    if (stepMatch) {
      const n = Number(stepMatch[1]);
      return Response.json(
        n === 2 ? step2 : { ...step2, step: n, goals: [], kpis: [], dimensions: [] },
      );
    }
    if (
      request.url === `/api/warengruppen/strategien/${strategyId}/ziele` &&
      request.method === 'POST'
    ) {
      sent.push(request);
      return Response.json(step2, { status: 201 });
    }
    if (
      request.url.startsWith(`/api/warengruppen/strategien/${strategyId}/ziele/`) &&
      request.method === 'PATCH'
    ) {
      sent.push(request);
      return Response.json(step2);
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('WG-04 Strategie und Ablauf', () => {
  it('die Übersicht zeigt die nächste Aufgabe und je Warengruppe Umsatz, Lieferanten, Lead, Ringe und Stand', async () => {
    renderAt('/warengruppen');
    expect(
      await screen.findByText('Dein nächster Schritt · Leiterplatten, Schritt 2 von 10'),
    ).toBeTruthy();
    expect(screen.getByText('Messbare Ziele setzen')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Öffnen/ }).getAttribute('href')).toBe(
      `/warengruppen/${group}/strategie/2`,
    );
    const list = screen.getByRole('region', { name: 'Strategien 2027' });
    expect(within(list).getByText('1 von 2 freigegeben')).toBeTruthy();
    expect(within(list).getByRole('img', { name: '1 von 10 Schritten fertig' })).toBeTruthy();
    expect(within(list).getByText('Entwurf')).toBeTruthy();
    expect(within(list).getByText('noch nicht begonnen')).toBeTruthy();
    expect(within(list).getByText(/7 Lieferanten · Lead Anna Schmidt/)).toBeTruthy();
  });

  it('die Ablauf-Leiste zeigt den Stand jedes Schritts als Text; jeder Schritt ist anspringbar', async () => {
    renderAt(`/warengruppen/${group}/strategie/7`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Initiativen in der Scorecard planen' }),
    ).toBeTruthy();
    const flow = await screen.findByRole('list', { name: 'Schritt 7 von 10' });
    expect(within(flow).getByRole('link', { name: 'Aufsetzen, fertig' }).getAttribute('href')).toBe(
      `/warengruppen/${group}/strategie/1`,
    );
    expect(within(flow).getByRole('link', { name: 'Ziele, in Arbeit' })).toBeTruthy();
    expect(
      within(flow).getByRole('link', { name: 'Scorecard, offen' }).getAttribute('aria-current'),
    ).toBe('step');
    expect(screen.getByText('die Beobachtung und Erklärung ausgefüllt ist.')).toBeTruthy();
    // Warengruppen-Leiste mit Stand als Chip
    const bar = screen.getByRole('navigation', { name: 'Warengruppe' });
    expect(within(bar).getByText('Strategie 2027 · Entwurf')).toBeTruthy();
    expect(within(bar).getByText(/7 Lieferanten · Lead Anna Schmidt/)).toBeTruthy();
  });

  it('ohne Recht ist der Schritt lesbar, aber nicht bearbeitbar', async () => {
    context = {
      ...context,
      context: context.context && { ...context.context, role: 'function', editableSteps: [] },
    };
    renderAt(`/warengruppen/${group}/strategie/3`);
    expect(
      await screen.findByText('Du kannst diesen Schritt lesen, aber nicht bearbeiten.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
  });
});

describe('WG-06 Ziele der Warengruppe', () => {
  it('die Tabelle zeigt Ziele je Dimension; Zurückstellen verlangt eine Begründung', async () => {
    renderAt(`/warengruppen/${group}/strategie/2`);
    expect(await screen.findByText('Kapazität für den Anlauf 2028 absichern')).toBeTruthy();
    expect(screen.getByText('82 %')).toBeTruthy();
    expect(screen.getByText('Q4/2028')).toBeTruthy();
    expect(
      screen.getByText(/Ohne Ziel: Qualität, Kosten, Technologie, Nachhaltigkeit/),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Begründung der Auswahl' })).toBeTruthy();
    expect(screen.getByText('Lieber wenige Ziele')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ziel hinzufügen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ziel speichern' }));
    expect(await screen.findByText('Bitte eine Kennzahl wählen.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Kennzahl'), { target: { value: uuid(41) } });
    fireEvent.click(screen.getByLabelText('Diese Kennzahl zurückstellen'));
    fireEvent.click(screen.getByRole('button', { name: 'Ziel speichern' }));
    expect(await screen.findByText('Zurückstellen braucht eine Begründung.')).toBeTruthy();
    expect(sent).toEqual([]);
    fireEvent.change(screen.getByLabelText('Begründung'), {
      target: { value: 'Daten noch nicht belastbar' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ziel speichern' }));
    await waitFor(() =>
      expect(sent[0]?.body).toMatchObject({
        kpiId: uuid(41),
        deferred: true,
        deferredReason: 'Daten noch nicht belastbar',
      }),
    );
  });
  it('WG-06: ein Ist aus dem Portal steht mit Stand in der Tabelle und ist im Formular nicht änderbar', async () => {
    step2 = {
      ...step2,
      goals: step2.goals.map((goal) => ({
        ...goal,
        actual: 90,
        actualSource: 'portal' as const,
        actualAsOf: '2026-03-01',
      })),
    };
    renderAt(`/warengruppen/${group}/strategie/2`);
    expect(await screen.findByText('aus dem Portal, Stand März 2026')).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', { name: 'Bearbeiten: Kapazität für den Anlauf 2028 absichern' }),
    );
    expect(
      await screen.findByText(
        'Ist 90 % aus den Scorecards der Lieferanten, Stand März 2026. Das Portal aktualisiert ihn.',
      ),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Ist')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ziel speichern' }));
    await waitFor(() => expect(sent[0]?.body).toBeDefined());
    expect(sent[0]?.body).not.toHaveProperty('actual');
  });
});
