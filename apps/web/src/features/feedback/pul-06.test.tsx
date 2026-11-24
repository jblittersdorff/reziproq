// @vitest-environment jsdom
import type {
  ActionItem,
  SurveyResults,
  SurveyWave,
  SurveyWaveDetail,
  SurveyWaves,
} from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/PUL-06.md in der Oberfläche: Maßnahme aus einer Lücke mit vorbefüllter Seite
// und richtiger Quelle, Abschnitt „Ihr habt gesagt, wir haben gehandelt“, Verlauf je Art.

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
const withActions: SurveyResults = {
  ...results,
  actions: [
    {
      id: uuid(50),
      title: 'Prognose monatlich teilen',
      dimension: 'transparency',
      status: 'in_progress',
      visibility: 'shared',
      own: true,
      ownerName: 'Ida Roth',
      dueDate: '2027-06-30',
    },
    {
      id: uuid(51),
      title: 'Zweitquelle prüfen',
      dimension: 'trust',
      status: 'open',
      visibility: 'internal',
      own: true,
      ownerName: 'Sara Ost',
      dueDate: '2027-07-31',
    },
  ],
};
const waves: SurveyWaves = {
  waves: [wave],
  canStart: true,
  trends: [
    {
      kind: 'pulse',
      waves: [
        { id: uuid(31), revealedAt: '2026-03-31T10:00:00Z' },
        { id: uuid(32), revealedAt: '2026-09-30T10:00:00Z' },
      ],
      dimensions: [{ dimension: 'trust', buyer: [4, 4.1], supplier: [3, 3.5] }],
    },
  ],
};
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = [...actionsFor.admin, 'feedback.sehen', 'feedback.verwalten'];
  sent = [];
  const detail: SurveyWaveDetail = {
    wave,
    ownSide: 'buyer',
    participants: [],
    canInvite: false,
    canClose: false,
    canExtend: false,
    results: withActions,
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
    if (request.url === `/api/suppliers/${rel}/feedback`) return Response.json(waves);
    if (request.url === `/api/suppliers/${rel}/feedback/${waveId}`) return Response.json(detail);
    if (request.url === `/api/suppliers/${rel}/massnahmen`) {
      if (request.method === 'POST') {
        sent.push(request);
        return Response.json({} as ActionItem, { status: 201 });
      }
      return Response.json({
        actions: [],
        canCreate: true,
        people: [{ userId: 'anna', name: 'Anna Schmidt' }],
      });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const base = `/lieferanten/${rel}/beziehung/feedback`;
const transparency = results.dimensions[0]?.resultId as string;

describe('PUL-06 Maßnahmen aus Lücken und Verlauf in der Oberfläche', () => {
  it('jede der größten Lücken und jede Dimension führt zu einer neuen Maßnahme mit Quelle', async () => {
    renderAt(`${base}/${waveId}`);
    const tile = (await screen.findByText('Größte Lücke 1')).closest('[data-delta]') as HTMLElement;
    expect(
      within(tile)
        .getByRole('link', { name: 'Maßnahme zur Lücke Transparenz anlegen' })
        .getAttribute('href'),
    ).toBe(
      `/lieferanten/${rel}/umsetzung/massnahmen/neu?luecke=${transparency}&dimension=transparency`,
    );
    const row = document.querySelector('li[data-dimension="strategy"]') as HTMLElement;
    expect(
      within(row).getByRole('link', { name: /Maßnahme zur Lücke Strategische Ausrichtung/ }),
    ).toBeDefined();
  });

  it('„Ihr habt gesagt, wir haben gehandelt“ listet die Maßnahmen der Welle mit Status', async () => {
    renderAt(`${base}/${waveId}`);
    const section = (
      await screen.findByRole('heading', { name: 'Ihr habt gesagt, wir haben gehandelt' })
    ).parentElement as HTMLElement;
    const items = within(section).getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('Prognose monatlich teilen');
    expect(items[0]?.textContent).toContain('In Arbeit');
    expect(items[1]?.textContent).toContain('Intern');
  });

  it('die neue Maßnahme ist vorbefüllt und trägt die Lücke als Quelle', async () => {
    renderAt(
      `/lieferanten/${rel}/umsetzung/massnahmen/neu?luecke=${transparency}&dimension=transparency`,
    );
    expect(((await screen.findByLabelText('Was ist zu tun?')) as HTMLInputElement).value).toBe(
      'Lücke Transparenz schließen',
    );
    expect(screen.getByText('Aus der Feedback-Lücke „Transparenz“')).toBeDefined();
    fireEvent.change(screen.getByLabelText('Frist'), { target: { value: '2027-06-30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Maßnahme anlegen' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.body).toMatchObject({ sourceType: 'feedback_gap', sourceId: transparency });
  });

  it('der Verlauf zeigt je Art die Werte beider Seiten über die Wellen', async () => {
    renderAt(base);
    const trend = (await screen.findByRole('heading', { name: 'Verlauf Puls' }))
      .parentElement as HTMLElement;
    const card = trend.querySelector('li[data-dimension="trust"]') as HTMLElement;
    const rows = within(card).getAllByRole('row');
    expect(rows[1]?.textContent).toBe('Eure Seite44,1');
    expect(rows[2]?.textContent).toBe('Lieferant33,5');
    expect(screen.queryByRole('heading', { name: 'Verlauf Jahres-Feedback' })).toBeNull();
  });
});
