// @vitest-environment jsdom
import {
  type DecisionHistory,
  defaultSegmentCriteria,
  defaultSegmentTypes,
  type Segmentation,
  type SupplierDetail,
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

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const relationshipId = '0190a0a0-0000-7000-8000-000000000001';
const base = `/lieferanten/${relationshipId}/strategie/segmentierung`;
const unit = (suffix: string, name: string) => ({
  id: `550e8400-e29b-41d4-a716-4466554400${suffix}`,
  name,
});
const detail: SupplierDetail = {
  relationshipId,
  name: 'Alpha GmbH',
  organizationName: 'Alpha GmbH',
  country: 'DE',
  vatId: null,
  duns: null,
  externalRef: null,
  notes: null,
  status: 'active',
  createdAt: '2026-10-01T08:00:00Z',
  endedAt: null,
  spend: [],
  permissions: { edit: true, editTeam: false },
};
const outcome = (typeName: string) => ({
  impactScore: 70,
  qualityScore: 40,
  impactLevel: 3 as const,
  qualityLevel: 2 as const,
  typeName,
});
const key = defaultSegmentCriteria[0]?.key ?? '';
const response: Segmentation = {
  segmentation: {
    roundId: '550e8400-e29b-41d4-a716-446655440031',
    roundName: 'Runde 2026',
    status: 'provisional',
    decision: null,
    model: {
      version: 1,
      gridSize: 3,
      lowMax: 33,
      midMax: 66,
      criteria: defaultSegmentCriteria.map((criterion) => ({ ...criterion })),
      types: defaultSegmentTypes.map((type) => ({ ...type })),
    },
    overall: { ist: outcome('Strategisch'), soll: outcome('Partner'), count: 2 },
    groups: [
      {
        businessUnit: unit('33', 'Antrieb'),
        materialGroup: unit('34', 'Stahl'),
        ist: outcome('Strategisch'),
        soll: outcome('Partner'),
        count: 2,
        status: 'provisional',
      },
    ],
    rows: [
      {
        assignmentId: '550e8400-e29b-41d4-a716-446655440040',
        businessUnit: unit('33', 'Antrieb'),
        materialGroup: unit('34', 'Stahl'),
        function: 'quality',
        values: defaultSegmentCriteria.map((criterion) => ({
          criterionKey: criterion.key,
          ist: 80,
          soll: 90,
          comment: criterion.key === key ? 'Liefert verlässlich' : null,
        })),
        deviation: 30,
      },
    ],
    stats: defaultSegmentCriteria.map((criterion) => ({
      criterionKey: criterion.key,
      mean: 50,
      min: 20,
      max: 80,
    })),
  },
};

const decided = (type: string) => ({
  impactLevel: 2,
  qualityLevel: 2,
  typeName: type,
});
let history: DecisionHistory = { versions: [], canConsolidate: true };
let posted: unknown[] = [];
let current: Segmentation | 'error';

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  current = response;
  history = { versions: [], canConsolidate: true };
  posted = [];
  api.handle = ({ url, method, body }) => {
    if (url === `/api/suppliers/${relationshipId}`) return Response.json(detail);
    if (url.endsWith('/decisions')) {
      if (method === 'POST') {
        posted.push(body);
        return Response.json(history);
      }
      return Response.json(history);
    }
    if (url.startsWith('/api/ratings/relationship/')) {
      return current === 'error'
        ? Response.json({ code: 'fehler' }, { status: 403 })
        : Response.json(current);
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('SEG-05 Segmentierung je Lieferant', () => {
  it('zeigt Gruppen mit Ist, Soll, Anzahl und dem Status „Vorläufig“', async () => {
    renderAt(base);
    expect(await screen.findByText('Antrieb · Stahl')).toBeTruthy();
    expect(screen.getByText('Ist: Strategisch')).toBeTruthy();
    expect(screen.getByText('Soll: Partner')).toBeTruthy();
    expect(screen.getAllByText('Vorläufig').length).toBeGreaterThan(0);
    expect(screen.getByText('Intern')).toBeTruthy();
  });

  it('jedes Kriterium führt zur Detailseite mit Wert und Kommentar', async () => {
    renderAt(base);
    const name = defaultSegmentCriteria[0]?.name ?? '';
    // Im Inhalt; die Leiste des Lieferanten hat eine Unterseite gleichen Namens (Spend).
    await screen.findByText('Antrieb · Stahl');
    const link = within(screen.getByRole('main')).getByRole('link', { name });
    expect(link.getAttribute('href')).toBe(`${base}/kriterium/${key}`);
    renderAt(`${base}/kriterium/${key}`);
    expect(await screen.findByText('Liefert verlässlich')).toBeTruthy();
  });

  it('ohne abgegebene Bewertung steht ein leerer Zustand mit Verweis auf die Bewertungen da', async () => {
    current = { segmentation: null };
    renderAt(base);
    expect(await screen.findByText('Noch keine abgegebene Bewertung')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Zu den Bewertungen' }).getAttribute('href')).toBe(
      '/bewertungen',
    );
  });

  it('bei einem Fehler erscheint der Fehlerzustand', async () => {
    current = 'error';
    renderAt(base);
    await waitFor(() =>
      expect(screen.getByText('Die Segmentierung konnte nicht geladen werden.')).toBeTruthy(),
    );
  });
});

describe('SEG-06 Konsolidierung', () => {
  it('der Knopf „Konsolidieren“ erscheint nur für SRO und Admin', async () => {
    history = { versions: [], canConsolidate: false };
    renderAt(base);
    await screen.findByText('Antrieb · Stahl');
    expect(screen.queryByRole('link', { name: 'Konsolidieren' })).toBeNull();
  });

  it('der Verlauf zeigt jede Version mit Person, Typen und Begründung', async () => {
    history = {
      canConsolidate: true,
      versions: [
        {
          version: 1,
          decidedAt: '2026-11-02T10:00:00+00:00',
          decidedBy: { userId: 'u1', name: 'Sven Rohde' },
          modelVersion: 1,
          entries: [
            {
              scope: 'total',
              businessUnit: null,
              materialGroup: null,
              ist: decided('Strategisch'),
              soll: decided('Partner'),
              reason: 'Weil es passt',
            },
          ],
        },
      ],
    };
    renderAt(base);
    expect(await screen.findByText(/Weil es passt/)).toBeTruthy();
    expect(screen.getByText(/Sven Rohde/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Konsolidieren' }).getAttribute('href')).toBe(
      `${base}/konsolidieren`,
    );
  });

  it('ohne Begründung geht es nicht weiter; am Ende wird alles festgelegt', async () => {
    renderAt(`${base}/konsolidieren`);
    expect(await screen.findByText('Schritt 1 von 2')).toBeTruthy();
    const next = screen.getByRole('button', { name: 'Weiter' });
    expect(next.hasAttribute('disabled')).toBe(true);
    fireEvent.change(screen.getByLabelText('Begründung'), { target: { value: 'Antrieb passt' } });
    fireEvent.click(next);
    expect(await screen.findByText('Schritt 2 von 2')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Begründung'), { target: { value: 'Gesamt passt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Festlegen' }));
    await waitFor(() => expect(posted).toHaveLength(1));
    const request = posted[0] as { total: { reason: string }; entries: { reason: string }[] };
    expect(request.total.reason).toBe('Gesamt passt');
    expect(request.entries.map((entry) => entry.reason)).toEqual(['Antrieb passt']);
  });

  it('ohne Recht steht ein Hinweis da', async () => {
    history = { versions: [], canConsolidate: false };
    renderAt(`${base}/konsolidieren`);
    expect(await screen.findByText('Nur für Verantwortliche')).toBeTruthy();
  });
});
