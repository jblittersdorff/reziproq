// @vitest-environment jsdom
import type { PlanSummaryDraft, SupplierPlanResponse } from '@reziproq/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/SPL-10.md in der Oberfläche: Entwurf als KI-Entwurf, Übernehmen setzt ihn
// ins Feld, Teil des Plans erst mit Speichern.

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
const draftText =
  'Rheintal soll zum strategischen Partner für die neue Plattform werden. Fortschritt zeigt sich an Liefertreue und Kosten.';
let draft: PlanSummaryDraft;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  draft = { canDraft: true, draft: null };
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
    if (request.url === `/api/suppliers/${rel}/plan`) return Response.json(response('draft'));
    const draftPath = `/api/suppliers/${rel}/plan/${planId}/summary/draft`;
    if (request.url.startsWith(draftPath)) {
      if (request.method === 'POST') {
        sent.push(request);
        draft =
          request.url === draftPath
            ? {
                canDraft: true,
                draft: {
                  id: uuid(70),
                  status: 'draft',
                  content: draftText,
                  model: 'test',
                  createdAt: '2026-11-16T09:00:00Z',
                  decidedAt: null,
                },
              }
            : { canDraft: true, draft: null };
      }
      return Response.json(draft);
    }
    if (request.url === `/api/suppliers/${rel}/plan/${planId}/summary`) {
      sent.push(request);
      return Response.json(request.body);
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const page = `/lieferanten/${rel}/strategie/lieferantenplan/zusammenfassung/bearbeiten`;

describe('SPL-10 KI-Entwurf der Strategie-Zusammenfassung', () => {
  it('Übernehmen setzt den Entwurf ins Feld; Teil des Plans wird er erst mit Speichern', async () => {
    renderAt(page);
    fireEvent.click(await screen.findByRole('button', { name: 'Entwurf vorschlagen' }));
    expect(await screen.findByText('KI-Entwurf, bitte prüfen')).toBeTruthy();
    expect(document.querySelector('[data-slot="ai-draft"]:not([data-confirmed])')).toBeTruthy();
    const field = screen.getByLabelText('Zusammenfassung', { exact: true }) as HTMLTextAreaElement;
    expect(field.value).toBe('Partner für die neue Plattform.');

    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    await waitFor(() => expect(field.value).toBe(draftText));
    expect(screen.getByText(/Teil des Plans wird er erst mit „Speichern“/)).toBeTruthy();
    // Bisher nur Entwurf und Übernehmen, kein Speichern des Plans
    expect(sent.map((request) => request.url.split('/summary')[1])).toEqual([
      '/draft',
      `/draft/${uuid(70)}/accept`,
    ]);

    fireEvent.change(field, { target: { value: `${draftText} Ergänzt.` } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        method: 'PATCH',
        body: { summary: `${draftText} Ergänzt.` },
      }),
    );
  });

  it('wer nicht entwerfen darf, sieht keinen Knopf', async () => {
    draft = { canDraft: false, draft: null };
    renderAt(page);
    expect(await screen.findByLabelText('Zusammenfassung', { exact: true })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Entwurf vorschlagen' })).toBeNull();
  });
});
