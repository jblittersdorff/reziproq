// @vitest-environment jsdom
import type {
  ApprovalSettingsView,
  ApprovalView,
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

// Tests zu docs/specs/WG-16.md in der Oberfläche: Schritt 10 mit nächstem Schritt, Zusammenfassung
// mit „geändert“, Unterschriften mit Zurückgeben, neuer Version und dem Freigabeweg für Admins.

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
let approval: ApprovalView;
let settings: ApprovalSettingsView;
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
      steps: ['done', 'done', 'done', 'done', 'done', 'done', 'done', 'done', 'done', 'open'],
    },
    role: 'lead',
    editableSteps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
};
const content: StrategyStep = {
  step: 10,
  questions: [],
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
  kpis: [],
  goals: [],
};
const baseView = (): ApprovalView => ({
  strategyId,
  year: 2027,
  version: 1,
  status: 'draft',
  canEdit: true,
  canSubmit: false,
  blockers: ['summary_unconfirmed'],
  openSteps: [],
  relevance: {
    scores: {},
    score: 4.2,
    override: null,
    overrideReason: null,
    high: true,
    canOverride: false,
  },
  spend: { amountCents: 820_000_000, currency: 'EUR', high: true },
  route: 'board',
  summary: {
    statusQuo: 'Zwei Lieferanten tragen 65 % des Umsatzes.',
    targetState: 'Kapazität bestätigt bis 2028.',
    roadmap: 'Laminat direkt beziehen (2027).',
    status: 'draft',
    changed: ['roadmap'],
  },
  lastSubmittedAt: '2026-10-30T09:00:00Z',
  changedSinceSubmission: true,
  approvals: [],
  versions: [{ id: strategyId, version: 1, status: 'draft' }],
  canNewVersion: false,
});

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sent = [];
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  approval = baseView();
  settings = {
    settings: {
      relevanceThreshold: 3.5,
      spendThresholdCents: 500_000_000,
      routes: { board: [], head: [], tandem: [], department: [] },
    },
    people: [
      { userId: 'anna', name: 'Anna Schmidt' },
      { userId: 'jonas', name: 'Jonas Feld' },
    ],
    canEdit: true,
  };
  api.handle = (request) => {
    if (request.url === `/api/warengruppen/${group}/strategie`) return Response.json(context);
    if (request.url.endsWith('/schritte/10')) return Response.json(content);
    if (request.url === `/api/warengruppen/strategien/${strategyId}/freigabe`)
      return Response.json(approval);
    if (request.url === `/api/warengruppen/strategien/${strategyId}/supplier-map`)
      return Response.json({}, { status: 404 });
    if (request.url === '/api/warengruppen/freigabeweg') {
      if (request.method === 'PUT') sent.push(request);
      return Response.json(settings);
    }
    if (request.method !== 'GET' && request.url.startsWith('/api/warengruppen/')) {
      sent.push(request);
      if (
        request.url.endsWith('/zurueckgeben') &&
        !(request.body as { comment: string }).comment.trim()
      )
        return Response.json({ statusCode: 400, code: 'comment_required' }, { status: 400 });
      if (request.url.endsWith('/neue-version'))
        return Response.json({ id: uuid(61), version: 2 }, { status: 201 });
      return Response.json(approval, { status: 201 });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('WG-16 Freigabe', () => {
  it('nennt, was zum Vorlegen fehlt, und markiert geänderte Teile der Zusammenfassung', async () => {
    renderAt(`/warengruppen/${group}/strategie/10`);
    expect(
      await screen.findByRole('heading', {
        name: 'Strategie dem Leitungsgremium des Einkaufs vorlegen',
      }),
    ).toBeTruthy();
    expect(screen.getByText('Es fehlt noch: die übernommene Zusammenfassung.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Zur Freigabe vorlegen/ })).toBeNull();
    const summary = screen.getByRole('region', { name: 'Zusammenfassung' });
    const roadmap = within(summary).getByText('Roadmap').closest('div') as HTMLElement;
    expect(within(roadmap).getByText('geändert')).toBeTruthy();
    expect(within(summary).getAllByText('geändert')).toHaveLength(1);
    fireEvent.click(within(summary).getByRole('button', { name: 'Zusammenfassung übernehmen' }));
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        method: 'POST',
        url: `/api/warengruppen/strategien/${strategyId}/zusammenfassung/bestaetigen`,
      }),
    );
  });

  it('Vorlegen schickt die Strategie an den Freigabeweg', async () => {
    approval = { ...baseView(), canSubmit: true, blockers: [] };
    renderAt(`/warengruppen/${group}/strategie/10`);
    fireEvent.click(await screen.findByRole('button', { name: /Zur Freigabe vorlegen/ }));
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        method: 'POST',
        url: `/api/warengruppen/strategien/${strategyId}/vorlegen`,
      }),
    );
  });

  it('Freigebende geben nur mit Kommentar zurück', async () => {
    approval = {
      ...baseView(),
      blockers: ['not_lead'],
      approvals: [
        {
          id: uuid(70),
          role: 'lead',
          userId: 'sara',
          name: 'Sara Ost',
          status: 'signed',
          comment: null,
          decidedAt: '2026-11-12T09:00:00Z',
          canDecide: false,
        },
        {
          id: uuid(71),
          role: 'approver',
          userId: 'anna',
          name: 'Anna Schmidt',
          status: 'open',
          comment: null,
          decidedAt: null,
          canDecide: true,
        },
      ],
    };
    renderAt(`/warengruppen/${group}/strategie/10`);
    expect(await screen.findByText('unterschrieben 12.11.2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Zurückgeben' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zur Wiedervorlage zurückgeben' }));
    expect(
      await screen.findByText('Bitte einen Kommentar zur Wiedervorlage schreiben.'),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Kommentar zur Wiedervorlage'), {
      target: { value: 'Roadmap ohne Termine.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zur Wiedervorlage zurückgeben' }));
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        url: `/api/warengruppen/freigaben/${uuid(71)}/zurueckgeben`,
        body: { comment: 'Roadmap ohne Termine.' },
      }),
    );
  });

  it('eine freigegebene Strategie bekommt eine neue Version statt Änderungen', async () => {
    approval = {
      ...baseView(),
      status: 'approved',
      canEdit: false,
      blockers: ['approved'],
      canNewVersion: true,
      versions: [{ id: strategyId, version: 1, status: 'approved' }],
    };
    renderAt(`/warengruppen/${group}/strategie/10`);
    expect(await screen.findByText('Version 1 · Freigegeben')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bearbeiten' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Wofür die Strategie danach gilt' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Neue Version anlegen' }));
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        method: 'POST',
        url: `/api/warengruppen/strategien/${strategyId}/neue-version`,
      }),
    );
  });

  it('Admins stellen Schwellen und Freigebende je Weg ein', async () => {
    api.me = { ...anna, orgRole: 'admin' };
    api.permissions = actionsFor.admin;
    renderAt('/einstellungen/warengruppen/freigabeweg');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Freigabeweg der Warengruppen' }),
    ).toBeTruthy();
    const board = await screen.findByRole('group', { name: 'Leitungsgremium des Einkaufs' });
    fireEvent.click(within(board).getByLabelText('Jonas Feld'));
    fireEvent.change(screen.getByLabelText('Umsatz hoch ab (Euro im Jahr)'), {
      target: { value: '2000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Freigabeweg speichern' }));
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        method: 'PUT',
        url: '/api/warengruppen/freigabeweg',
        body: {
          relevanceThreshold: 3.5,
          spendThresholdCents: 200_000_000,
          routes: { board: ['jonas'], head: [], tandem: [], department: [] },
        },
      }),
    );
  });
});
