// @vitest-environment jsdom

import type { SurveyResults, SurveyWave, SurveyWaveDetail } from '@reziproq/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';
import { expectPageLimits } from '@/testing/page-limits';

// Tests zu docs/specs/PUL-03.md in der Oberfläche: vor der Aufdeckung nur der Hinweis, danach die
// drei größten Lücken oben, Hantel je Dimension nach Lücke sortiert und nicht nur über Farbe
// lesbar, Funktionen nur ab drei Antworten, Freitexte der anderen Seite.

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
let detail: SurveyWaveDetail;

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = [...actionsFor.admin, 'feedback.sehen', 'feedback.verwalten'];
  detail = {
    wave,
    ownSide: 'buyer',
    participants: [],
    canInvite: false,
    canClose: false,
    canExtend: false,
    results,
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
    if (request.url === `/api/suppliers/${rel}/feedback/${waveId}`) return Response.json(detail);
    return undefined;
  };
});

afterEach(tearDownApp);

const base = `/lieferanten/${rel}/beziehung/feedback`;

describe('PUL-03 Auswertung in der Oberfläche', () => {
  it('vor der Aufdeckung nur der Hinweis, keine Zahlen', async () => {
    detail = {
      ...detail,
      wave: { ...wave, status: 'open', revealedAt: null, topGap: null },
      results: null,
    };
    renderAt(`${base}/${waveId}`);
    expect(
      await screen.findByText(
        'Ergebnisse erscheinen, wenn beide Seiten abgeschlossen haben oder die Frist vorbei ist.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Ergebnis' })).toBeNull();
  });

  it('die drei größten Lücken stehen oben, die Hantel ist nach Lücke sortiert', async () => {
    renderAt(`${base}/${waveId}`);
    await screen.findByRole('heading', { name: 'Ergebnis' });
    const tiles = [...document.querySelectorAll('[data-slot="top-gaps"] [data-delta]')];
    expect(tiles.map((tile) => tile.getAttribute('data-delta'))).toEqual([
      'transparency',
      'trust',
      'integration',
    ]);
    expect(tiles[0]?.textContent).toContain('0,9');
    expect(tiles[0]?.textContent).toContain('Eure Seite 4,1 · Lieferant 3,2');
    const rows = [...document.querySelectorAll('li[data-dimension]')];
    expect(rows.map((row) => row.getAttribute('data-dimension'))).toEqual([
      'transparency',
      'trust',
      'integration',
      'collaboration',
      'strategy',
    ]);
    // Nicht nur über Farbe: jede Zeile nennt beide Werte und die Lücke als Text.
    expect(rows[0]?.textContent).toContain('Eure Seite 4,1 · Lieferant 3,2');
    expect(rows[0]?.textContent).toContain('Lücke 0,9');
    // AW-01: nur Lücken ab 0,5 sind markiert
    for (const row of rows) {
      const gap = Number((row.textContent?.match(/Lücke (\d+,\d+)/)?.[1] ?? '0').replace(',', '.'));
      expect(row.querySelector('[data-gap="marked"]') !== null).toBe(gap >= 0.5);
    }
  });

  it('AW-01: über den Lücken steht die Aussage von Reziproq mit Quelle', async () => {
    detail = {
      ...detail,
      results: {
        ...results,
        statement: {
          id: '0190a0a0-0000-7000-8000-000000000301',
          headline: 'Bei Transparenz liegen beide Seiten 0,9 Punkte auseinander.',
          body: 'Ihr seht Transparenz besser: 4,1 gegen 3,2.',
          sources: [{ key: 'dimension', label: 'Feedback-Welle, beide Seiten aufgedeckt' }],
        },
      },
    };
    renderAt(`${base}/${waveId}`);
    expect(
      await screen.findByText('Bei Transparenz liegen beide Seiten 0,9 Punkte auseinander.'),
    ).toBeTruthy();
    expect(screen.getByText('Zusammengefasst von Reziproq')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stimmt nicht' })).toBeTruthy();
    expectPageLimits();
  });

  it('Funktionen nur ab drei Antworten; Freitexte der anderen Seite', async () => {
    renderAt(`${base}/${waveId}`);
    const group = await screen.findByRole('group', { name: 'Nach Funktion' });
    expect(
      within(group)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Gesamt', 'Einkauf']);
    fireEvent.click(within(group).getByRole('button', { name: 'Einkauf' }));
    expect(
      await screen.findByText('Eure Seite 3 · Lieferant – Antworten in dieser Funktion'),
    ).toBeDefined();
    expect(document.querySelectorAll('li[data-dimension]')).toHaveLength(1);
    const texts = screen.getByRole('heading', { name: 'Was Lieferant schreibt' })
      .parentElement as HTMLElement;
    expect(
      within(texts)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Prognosen kommen zu spät.', 'Gute Zusammenarbeit im Werk.']);
  });

  it('die Liste zeigt Aufgedeckt und die größte Lücke', async () => {
    renderAt(base);
    const row = (await screen.findByRole('link', { name: /Jahres-Feedback · Frist/ })).closest(
      'li',
    ) as HTMLElement;
    expect(row.textContent).toContain('Aufgedeckt');
    expect(row.textContent).toContain('Größte Lücke: Transparenz 0,9');
  });
});
