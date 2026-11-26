// @vitest-environment jsdom
import {
  type DeviationExplanations,
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

// SEG-11 für die Oberfläche: Entwürfe gestrichelt mit Übernehmen und Verwerfen, übernommene
// Erklärungen fest; ohne Begründungen ein Hinweis statt eines Entwurfs.

const [first, second, third] = defaultSegmentCriteria;
const draftId = '550e8400-e29b-41d4-a716-446655440051';
const draft = {
  id: draftId,
  status: 'draft' as const,
  content: 'Qualität sieht enge Abstimmung. Der Einkauf erlebt schwankende Liefertreue.',
  model: 'test',
  createdAt: '2026-11-16T09:00:00Z',
  decidedAt: null,
};
const explanation = (criterion: typeof first, reasons: number) => ({
  criterionKey: criterion?.key ?? '',
  criterionName: criterion?.name ?? '',
  range: 60,
  reasons,
  draft: null,
  accepted: null,
});
let explanations: DeviationExplanations;
let requests: { method: string; url: string }[] = [];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'admin' };
  api.permissions = actionsFor.admin;
  requests = [];
  explanations = {
    roundId: response.segmentation?.roundId ?? null,
    canExplain: true,
    withoutReasons: [],
    explanations: [explanation(first, 2), explanation(second, 1), explanation(third, 0)],
  };
  api.handle = ({ url, method }) => {
    if (url === `/api/suppliers/${relationshipId}`) return Response.json(detail);
    if (url.endsWith('/decisions')) return Response.json({ versions: [], canConsolidate: true });
    if (url.includes('/segmentation/explanations')) {
      requests.push({ method, url });
      if (method === 'POST' && url.endsWith('/explanations')) {
        explanations = {
          ...explanations,
          withoutReasons: [third?.key ?? ''],
          explanations: [
            { ...explanation(first, 2), draft },
            explanation(second, 1),
            explanation(third, 0),
          ],
        };
      }
      if (method === 'POST' && url.endsWith('/accept')) {
        explanations = {
          ...explanations,
          withoutReasons: [],
          explanations: [
            {
              ...explanation(first, 2),
              accepted: { ...draft, status: 'accepted', decidedAt: '2026-11-16T10:00:00Z' },
            },
            explanation(second, 1),
            explanation(third, 0),
          ],
        };
      }
      return Response.json(explanations);
    }
    if (url === `/api/ratings/relationship/${relationshipId}/segmentation`)
      return Response.json(response);
    return undefined;
  };
});

afterEach(tearDownApp);

describe('SEG-11 KI erklärt Abweichungen', () => {
  it('der Entwurf ist als Entwurf gekennzeichnet, bis er übernommen wird', async () => {
    renderAt(base);
    const section = await screen.findByRole('region', { name: 'Abweichungen verstehen' });
    fireEvent.click(await within(section).findByRole('button', { name: 'Abweichungen erklären' }));
    expect(await within(section).findByText('KI-Entwurf, bitte prüfen')).toBeTruthy();
    expect(within(section).getByText(draft.content)).toBeTruthy();
    expect(section.querySelector('[data-slot="ai-draft"]:not([data-confirmed])')).toBeTruthy();
    // Quelle: die Begründungen zum Kriterium
    expect(within(section).getByRole('link', { name: '2 Begründungen' }).getAttribute('href')).toBe(
      `${base}/kriterium/${first?.key}`,
    );

    fireEvent.click(within(section).getByRole('button', { name: `Übernehmen: ${first?.name}` }));
    expect(await within(section).findByText(/übernommen am/)).toBeTruthy();
    expect(within(section).queryByText('KI-Entwurf, bitte prüfen')).toBeNull();
    expect(section.querySelector('[data-slot="ai-draft"][data-confirmed]')).toBeTruthy();
    expect(requests.at(-1)).toEqual({
      method: 'POST',
      url: `/api/ratings/relationship/${relationshipId}/segmentation/explanations/${draftId}/accept`,
    });
  });

  it('ohne Begründungen steht ein Hinweis statt eines Entwurfs', async () => {
    renderAt(base);
    const section = await screen.findByRole('region', { name: 'Abweichungen verstehen' });
    fireEvent.click(await within(section).findByRole('button', { name: 'Abweichungen erklären' }));
    expect(
      await within(section).findByText(new RegExp(`Zu ${third?.name} gibt es keine Begründungen`)),
    ).toBeTruthy();
  });

  it('wer nicht erklären darf, sieht keinen Knopf', async () => {
    explanations = { ...explanations, canExplain: false };
    renderAt(base);
    const section = await screen.findByRole('region', { name: 'Abweichungen verstehen' });
    await waitFor(() =>
      expect(within(section).getAllByText('Noch keine übernommene Erklärung.').length).toBe(3),
    );
    expect(within(section).queryByRole('button', { name: 'Abweichungen erklären' })).toBeNull();
  });
});
