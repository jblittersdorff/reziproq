// @vitest-environment jsdom
import type { PlanVersion, SupplierPlanResponse } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';
import { compareVersions } from './approval-pages';

// Tests zu docs/specs/SPL-07.md in der Oberfläche: Zur Freigabe mit Hinweisen, Freigeben und
// Zurückgeben mit Pflichtbegründung, Vergleich zweier Versionen.

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
const rel = uuid(1);
const planId = uuid(5);
const supplier = {
  relationshipId: rel,
  name: 'Rheintal Elektronik GmbH (Demo)',
  organizationName: 'Rheintal Elektronik GmbH (Demo)',
  country: 'DE',
  vatId: null,
  duns: null,
  externalRef: null,
  notes: null,
  status: 'active',
  createdAt: '2026-10-01T08:00:00Z',
  endedAt: null,
  spend: [],
  permissions: { edit: true, editTeam: true },
};
const response = (
  status: 'draft' | 'in_review' | 'approved',
  approval: Partial<NonNullable<SupplierPlanResponse['plan']>['approval']> = {},
): SupplierPlanResponse => ({
  plan: {
    id: planId,
    relationshipId: rel,
    cycleId: uuid(3),
    version: 1,
    status,
    summary: 'Partner für die neue Plattform.',
    createdAt: '2026-10-01T08:00:00Z',
    targetType: 'Strategischer Partner',
    sro: { userId: 'anna', name: 'Anna Schmidt' },
    objectives: [],
    contributions: { done: 0, total: 1, items: [] },
    topics: [],
    canManage: status === 'draft',
    approval: {
      round: status === 'draft' ? 0 : 1,
      submittedAt: status === 'draft' ? null : '2026-11-01T08:00:00Z',
      approvedAt: status === 'approved' ? '2026-11-03T08:00:00Z' : null,
      hasSponsor: true,
      decisions: [],
      hints: { openContributions: 1, noTopics: true },
      canSubmit: status === 'draft',
      canDecide: status === 'in_review',
      canNewVersion: status === 'approved',
      ...approval,
    },
  },
  cycleId: uuid(3),
  categories: [],
  teamCandidates: [],
  canCreate: false,
});
let current: SupplierPlanResponse;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  current = response('draft');
  api.handle = (request) => {
    if (request.url === `/api/suppliers/${rel}`) return Response.json(supplier);
    if (request.url.startsWith(`/api/suppliers/${rel}/overview`)) {
      return Response.json({
        head: { segment: null, sro: null, nextMeeting: null },
        metrics: [],
        cycle: null,
        canStartCycle: false,
        canSetJbpDate: false,
      });
    }
    if (request.url === `/api/suppliers/${rel}/plan`) return Response.json(current);
    if (request.url.startsWith(`/api/suppliers/${rel}/plan/${planId}/`)) {
      sent.push(request);
      if (request.url.endsWith('/submit')) current = response('in_review');
      return Response.json({ status: 'ok' }, { status: 201 });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const base = `/lieferanten/${rel}/strategie/lieferantenplan`;

describe('SPL-07 Freigabe in der Oberfläche', () => {
  it('Zur Freigabe zeigt vorher offene Beiträge und fehlende Themen und fragt auf der Seite nach', async () => {
    renderAt(base);
    const bar = await screen.findByRole('region', { name: 'Freigabe' });
    expect(within(bar).getByText('Ein Beitrag ist noch offen.')).toBeDefined();
    expect(within(bar).getByText('Noch kein strategisches Thema.')).toBeDefined();
    fireEvent.click(within(bar).getByRole('button', { name: 'Zur Freigabe' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Zur Freigabe schicken' }));
    await waitFor(() =>
      expect(sent.map((request) => request.url)).toEqual([
        `/api/suppliers/${rel}/plan/${planId}/submit`,
      ]),
    );
    expect(await screen.findByRole('link', { name: 'Zur Freigabe-Seite' })).toBeDefined();
  });

  it('Zurückgeben verlangt eine Begründung; Freigeben schickt die Entscheidung', async () => {
    current = response('in_review');
    renderAt(`${base}/freigabe`);
    fireEvent.click(await screen.findByRole('button', { name: 'Zurückgeben' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zurückgeben' }));
    expect(await screen.findByText('Bitte begründen.')).toBeDefined();
    expect(sent).toEqual([]);
    fireEvent.change(screen.getByLabelText('Begründung'), { target: { value: 'Ziele zu vage' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zurückgeben' }));
    await waitFor(() =>
      expect(sent[0]?.body).toEqual({ decision: 'returned', comment: 'Ziele zu vage' }),
    );
  });

  it('freigegeben zeigt das Datum und „Neue Version bearbeiten“', async () => {
    current = response('approved');
    renderAt(base);
    const bar = await screen.findByRole('region', { name: 'Freigabe' });
    expect(within(bar).getByText(/^Freigegeben am/)).toBeDefined();
    expect(within(bar).getByRole('button', { name: 'Neue Version bearbeiten' })).toBeDefined();
    expect(within(bar).queryByRole('button', { name: 'Zur Freigabe' })).toBeNull();
  });

  it('der Vergleich zeigt geänderte Ziele, Themen und Zusammenfassung', () => {
    const version = (overrides: Partial<PlanVersion>): PlanVersion => ({
      id: uuid(10),
      version: 1,
      status: 'superseded',
      approvedAt: null,
      summary: 'Alt',
      objectives: [
        { categoryName: 'Kosten', reference: 'Elektronik', text: 'Minus 5 %', targetYear: 2027 },
      ],
      topics: [{ title: 'Plattform', reason: 'Neu', priority: 1 }],
      ...overrides,
    });
    const diff = compareVersions(
      version({}),
      version({
        id: uuid(11),
        version: 2,
        status: 'draft',
        summary: 'Neu',
        objectives: [
          { categoryName: 'Kosten', reference: 'Elektronik', text: 'Minus 7 %', targetYear: 2027 },
        ],
        topics: [
          { title: 'Plattform', reason: 'Geändert', priority: 1 },
          { title: 'Service', reason: 'Neu', priority: 2 },
        ],
      }),
    );
    expect(diff.summary).toEqual({ from: 'Alt', to: 'Neu' });
    expect(diff.objectives.added).toEqual(['Kosten · Elektronik · Minus 7 % · 2027']);
    expect(diff.objectives.removed).toEqual(['Kosten · Elektronik · Minus 5 % · 2027']);
    expect(diff.topics).toEqual({ added: ['Service'], removed: [], changed: ['Plattform'] });
  });
});
