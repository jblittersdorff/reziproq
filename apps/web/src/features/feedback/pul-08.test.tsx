// @vitest-environment jsdom
import type { FeedbackThemes, SurveyResults, SurveyWave, SurveyWaveDetail } from '@reziproq/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/PUL-08.md in der Oberfläche: Entwurf als KI-Entwurf mit Übernehmen, danach
// die Zusammenfassung über den Freitexten; unter drei Freitexten kein Knopf.

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
const waveId = uuid(30);
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
const dim = (
  dimension: SurveyResults['dimensions'][number]['dimension'],
  buyer: number,
  supplierIst: number,
) => ({
  dimension,
  resultId: `0190a0a0-0000-7000-8000-0000000001${String(dimension.length).padStart(2, '0')}`,
  buyer: { ist: buyer, soll: 4.6 },
  supplier: { ist: supplierIst, soll: 4.4 },
  delta: Math.round((buyer - supplierIst) * 100) / 100,
});
const results: SurveyResults = {
  revealedAt: '2027-04-01T09:00:00Z',
  responses: { buyer: 5, supplier: 4 },
  dimensions: [
    dim('transparency', 4.1, 3.2),
    dim('trust', 4.2, 3.6),
    dim('integration', 3.4, 3.7),
    dim('collaboration', 3.9, 3.8),
    dim('strategy', 4, 4),
  ],
  topGaps: [dim('transparency', 4.1, 3.2), dim('trust', 4.2, 3.6), dim('integration', 3.4, 3.7)],
  functions: [
    {
      function: 'purchasing',
      buyer: { n: 3, dimensions: [dim('trust', 4.5, 0)] },
      supplier: null,
      dimensions: [{ ...dim('trust', 4.5, 0), supplier: { ist: null, soll: null }, delta: null }],
    },
  ],
  questions: [
    {
      key: 'transparency_3',
      dimension: 'transparency',
      labelDe: 'Kostentreiber werden offen besprochen.',
      labelEn: 'Cost drivers are discussed openly.',
      buyer: { ist: 4, soll: 5 },
      supplier: { ist: 2.5, soll: 4.5 },
      delta: 1.5,
    },
  ],
  freeTexts: ['Prognosen kommen zu spät.', 'Gute Zusammenarbeit im Werk.'],
  actions: [],
  canCreateAction: true,
};
const wave: SurveyWave = {
  id: waveId,
  kind: 'annual',
  templateVersion: 2,
  dueDate: '2027-03-31',
  createdAt: '2027-03-01T09:00:00Z',
  createdByName: 'Sara Ost',
  buyerClosedAt: '2027-03-30T09:00:00Z',
  supplierClosedAt: '2027-03-31T09:00:00Z',
  status: 'closed',
  turnout: { buyer: { invited: 6, completed: 5 }, supplier: { invited: 5, completed: 4 } },
  revealedAt: '2027-04-01T09:00:00Z',
  topGap: { dimension: 'transparency', delta: 0.9 },
};

const draftId = uuid(60);
const content = [
  '- Abstimmungen bei Änderungen dauern aus Sicht der anderen Seite zu lange.',
  '- Die Prognosen für Abrufe kommen oft spät und schwanken stark.',
].join('\n');
let detail: SurveyWaveDetail;
let themes: FeedbackThemes;
let posted: string[] = [];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = [...actionsFor.admin, 'feedback.sehen', 'feedback.verwalten'];
  posted = [];
  detail = {
    wave,
    ownSide: 'buyer',
    participants: [],
    canInvite: false,
    canClose: false,
    canExtend: false,
    results: { ...results, freeTexts: ['Text eins.', 'Text zwei.', 'Text drei.'] },
  };
  themes = { freeTexts: 3, canSummarize: true, draft: null, accepted: null };
  const draft = {
    id: draftId,
    status: 'draft' as const,
    content,
    model: 'test',
    createdAt: '2027-04-02T09:00:00Z',
    decidedAt: null,
  };
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
    if (request.url === `/api/suppliers/${rel}/feedback`) {
      return Response.json({ waves: [wave], canStart: true, trends: [] });
    }
    const themesPath = `/api/suppliers/${rel}/feedback/${waveId}/themen`;
    if (request.url.startsWith(themesPath)) {
      if (request.method === 'POST') {
        posted.push(request.url.slice(themesPath.length));
        if (request.url === themesPath) themes = { ...themes, draft };
        if (request.url.endsWith('/uebernehmen')) {
          themes = {
            ...themes,
            draft: null,
            accepted: { ...draft, status: 'accepted', decidedAt: '2027-04-02T10:00:00Z' },
          };
        }
      }
      return Response.json(themes);
    }
    if (request.url === `/api/suppliers/${rel}/feedback/${waveId}`) return Response.json(detail);
    return undefined;
  };
});

afterEach(tearDownApp);

const base = `/lieferanten/${rel}/beziehung/feedback`;

describe('PUL-08 Themen der Freitexte', () => {
  it('der Entwurf ist als KI-Entwurf gekennzeichnet; übernommen steht er über den Freitexten', async () => {
    renderAt(`${base}/${waveId}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Freitexte zusammenfassen' }));
    expect(await screen.findByText('KI-Entwurf, bitte prüfen')).toBeTruthy();
    expect(
      screen.getByText('Die Prognosen für Abrufe kommen oft spät und schwanken stark.'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(await screen.findByText(/Zusammenfassung von Reziproq · übernommen am/)).toBeTruthy();
    expect(posted).toEqual(['', `/${draftId}/uebernehmen`]);
    // Die Zusammenfassung steht vor den Freitexten.
    const summary = screen.getByText(
      'Abstimmungen bei Änderungen dauern aus Sicht der anderen Seite zu lange.',
    );
    const firstText = screen.getByText('Text eins.');
    expect(
      summary.compareDocumentPosition(firstText) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText('Nur eure Seite sieht diese Zusammenfassung.')).toBeTruthy();
  });

  it('unter drei Freitexten gibt es keinen Knopf, sondern einen Hinweis', async () => {
    themes = { ...themes, freeTexts: 2 };
    renderAt(`${base}/${waveId}`);
    expect(
      await screen.findByText(
        'Für eine Zusammenfassung braucht es mindestens drei Freitexte; es gibt 2.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Freitexte zusammenfassen' })).toBeNull();
  });

  it('ohne Recht und ohne übernommene Zusammenfassung bleibt der Bereich leer', async () => {
    themes = { ...themes, canSummarize: false };
    renderAt(`${base}/${waveId}`);
    expect(await screen.findByText('Text eins.')).toBeTruthy();
    await waitFor(() => expect(posted).toEqual([]));
    expect(screen.queryByText('Themen der Freitexte')).toBeNull();
  });
});
