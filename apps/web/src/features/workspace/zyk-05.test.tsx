// @vitest-environment jsdom
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

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

// ZYK-05 für die Oberfläche: was übernommen wird, Bestätigung auf der Seite, Archiv nur lesend.

const rel = '550e8400-e29b-41d4-a716-446655440001';
let posted: unknown[] = [];

// Arbeitsbereich des Lieferanten: Name und Überblick, wie die Seiten sie über die Leiste laden.
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
  createdAt: '2025-01-01T08:00:00Z',
  endedAt: null,
  spend: [],
  permissions: { edit: true, editTeam: true },
};
const workspace = (url: string) =>
  url === `/api/suppliers/${rel}`
    ? Response.json(supplier)
    : url === `/api/suppliers/${rel}/overview`
      ? Response.json({
          head: { segment: null, sro: null, nextMeeting: null, isFocus: true },
          metrics: [],
          cycle: null,
          canStartCycle: false,
          canSetJbpDate: false,
        })
      : undefined;

const preview = (canStart = true) => ({
  current: { label: '2025', startedAt: '2025-01-10T08:00:00Z', jbpDate: '2025-12-04' },
  nextLabel: '2026',
  approvedPlan: { version: 2, objectives: 3 },
  jointPlan: { version: 1, approved: true },
  runningInitiatives: 4,
  openCommitments: 2,
  openActions: 5,
  canStart,
});

const archive = {
  cycles: [
    {
      id: '550e8400-e29b-41d4-a716-446655440010',
      label: '2025',
      startedAt: '2025-01-10T08:00:00Z',
      closedAt: '2026-11-16T08:00:00Z',
      jbpDate: '2025-12-04',
      supplierPlans: [
        {
          id: '550e8400-e29b-41d4-a716-446655440011',
          version: 2,
          status: 'approved',
          summary: 'Zweitquelle aufbauen',
          objectives: [{ category: 'Qualität', text: 'Reklamationen halbieren', targetYear: 2026 }],
          topics: ['Zweitquelle'],
        },
      ],
      jointPlans: [
        {
          version: 1,
          approvedAt: '2025-12-10T08:00:00Z',
          topics: [],
          initiatives: [
            { title: 'Preis Leiterplatten', startsOn: '2026-01-01', endsOn: '2026-12-31' },
          ],
          commitments: [],
        },
      ],
      scorecards: [],
      feedback: [
        {
          id: '550e8400-e29b-41d4-a716-446655440012',
          kind: 'annual',
          dueDate: '2025-10-31',
          revealed: true,
        },
      ],
    },
  ],
};

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = anna;
  api.permissions = actionsFor.admin;
  posted = [];
  api.handle = (request) => {
    if (request.url === `/api/suppliers/${rel}/cycle/next`) {
      if (request.method === 'POST') {
        posted.push(request.body);
        return Response.json({}, { status: 500 });
      }
      return Response.json(preview());
    }
    if (request.url === `/api/suppliers/${rel}/cycle/archive`) return Response.json(archive);
    return workspace(request.url);
  };
});

afterEach(tearDownApp);

describe('ZYK-05 Neuer Zyklus', () => {
  it('zeigt, was übernommen wird, und startet erst nach der Bestätigung auf der Seite', async () => {
    renderAt(`/lieferanten/${rel}/zyklus/neu`);
    expect(
      await screen.findByText('Lieferantenplan Version 2 mit 3 Zielen, als neuer Entwurf'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Bleiben, wo sie sind: 4 laufende Initiativen, 2 offene Zusagen, 5 offene Aufgaben',
      ),
    ).toBeTruthy();
    expect(
      (screen.getByRole('textbox', { name: 'Name des neuen Zyklus' }) as HTMLInputElement).value,
    ).toBe('2026');
    fireEvent.change(screen.getByLabelText('Termin des nächsten Joint Business Planning'), {
      target: { value: '2027-03-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zyklus starten' }));
    // Bestätigung auf der Seite, kein Fenster
    const confirm = await screen.findByRole('group', {
      name: 'Zyklus 2025 schließen und den neuen starten?',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Ja, starten' }));
    await waitFor(() => expect(posted).toEqual([{ label: '2026', jbpDate: '2027-03-15' }]));
  });

  it('ohne Recht steht nur der Hinweis, kein Knopf', async () => {
    api.handle = (request) =>
      request.url === `/api/suppliers/${rel}/cycle/next`
        ? Response.json(preview(false))
        : workspace(request.url);
    renderAt(`/lieferanten/${rel}/zyklus/neu`);
    expect(await screen.findByText('Den nächsten Zyklus starten SRO oder Admin.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Zyklus starten' })).toBeNull();
  });

  it('das Archiv zeigt den alten Zyklus vollständig und nur lesend', async () => {
    renderAt(`/lieferanten/${rel}/zyklus/archiv`);
    const cycle = await screen.findByRole('region', { name: 'Zyklus 2025' });
    expect(within(cycle).getByText('Reklamationen halbieren')).toBeTruthy();
    expect(within(cycle).getByText('Zweitquelle')).toBeTruthy();
    expect(within(cycle).getByText('Preis Leiterplatten')).toBeTruthy();
    expect(within(cycle).getByText('aufgedeckt')).toBeTruthy();
    expect(within(cycle).queryAllByRole('button')).toEqual([]);
    expect(within(cycle).queryAllByRole('textbox')).toEqual([]);
  });
});
