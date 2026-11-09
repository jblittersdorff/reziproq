// @vitest-environment jsdom
import type { Kpi, KpiDetail, KpiImportPreview, ScorecardView } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/JBP-09.md in der Oberfläche: Stand mit Symbol und Text, Kennzahl-Seite mit
// Verlauf und Werten, Wert erfassen nur für die verantwortliche Seite, Import mit Vorschau.

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
const kpi = (n: number, extra: Partial<Kpi> = {}): Kpi => ({
  id: uuid(n),
  own: true,
  ownerSide: 'buyer',
  initiative: null,
  name: `Kennzahl ${n}`,
  unit: '%',
  direction: 'higher',
  baseline: '91.5000',
  target: '98.0000',
  targetDate: '2027-12-31',
  ownerUserId: 'sara',
  ownerName: 'Sara Ost',
  benefitFor: 'both',
  startDate: '2027-01-01',
  values: [],
  track: null,
  canEnter: true,
  ...extra,
});
const view = (extra: Partial<ScorecardView> = {}): ScorecardView => ({
  hasPlan: true,
  ownSide: 'buyer',
  status: 'draft',
  version: 1,
  kpis: [
    kpi(20, { name: 'Liefertreue', initiative: { id: uuid(70), title: 'Zweitquelle' } }),
    kpi(21, {
      name: 'Reklamationsquote',
      own: false,
      ownerSide: 'supplier',
      direction: 'lower',
      unit: 'ppm',
      baseline: null,
      target: '50',
      ownerName: 'Kim Kaiser',
      benefitFor: 'buyer',
    }),
  ],
  signatures: [],
  deadline: '2027-01-08',
  tolerancePercent: 10,
  canEdit: true,
  canSign: true,
  canNewVersion: false,
  people: [{ userId: 'sara', name: 'Sara Ost' }],
  initiatives: [{ id: uuid(70), title: 'Zweitquelle' }],
  ...extra,
});
let current: ScorecardView;
let detail: KpiDetail;
let preview: KpiImportPreview;
let sent: { method: string; url: string; body: unknown }[];

const withValues = (): ScorecardView => ({
  ...view(),
  kpis: [
    kpi(20, {
      name: 'Liefertreue',
      values: [
        { period: '2027-01-01', value: '91.5' },
        { period: '2027-02-01', value: '93' },
      ],
      track: 'on_track',
    }),
    kpi(21, {
      name: 'Reklamationsquote',
      own: false,
      ownerSide: 'supplier',
      canEnter: false,
      track: 'off',
      values: [{ period: '2027-02-01', value: '200' }],
    }),
    kpi(22, { name: 'Lieferzeit', track: null }),
  ],
});

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  current = withValues();
  detail = {
    kpi: current.kpis[0] as KpiDetail['kpi'],
    values: [
      {
        period: '2027-02-01',
        value: '93.0000',
        source: 'csv',
        enteredByName: 'Sara Ost',
        enteredAt: '2027-03-01T10:00:00Z',
      },
      {
        period: '2027-01-01',
        value: '91.5000',
        source: 'manual',
        enteredByName: 'Sara Ost',
        enteredAt: '2027-02-01T10:00:00Z',
      },
    ],
    tolerancePercent: 10,
  };
  preview = { rows: [], valid: 0, invalid: 0 };
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
    if (request.url.startsWith('/api/audit')) return Response.json({ entries: [] });
    if (request.url.startsWith(`/api/suppliers/${rel}/jbp/scorecard/import`)) {
      sent.push(request);
      return Response.json(preview);
    }
    if (request.url.startsWith(`/api/suppliers/${rel}/jbp/scorecard/kennzahlen/`)) {
      if (request.method !== 'GET') sent.push(request);
      return Response.json(detail, { status: request.method === 'POST' ? 201 : 200 });
    }
    if (request.url === `/api/suppliers/${rel}/jbp/scorecard`) return Response.json(current);
    return undefined;
  };
});

afterEach(tearDownApp);

const base = `/lieferanten/${rel}/plan/scorecard`;

describe('JBP-09 Ist-Werte in der Oberfläche', () => {
  it('jede Kennzahl zeigt ihren Stand mit Symbol und Text, mit Werten auch eine kleine Linie', async () => {
    renderAt(base);
    const table = (await screen.findByRole('table')) as HTMLElement;
    const rows = within(table).getAllByRole('row').slice(1);
    const state = (row: HTMLElement | undefined) =>
      row?.querySelector('[data-track]')?.getAttribute('data-track');
    expect(rows.map((row) => state(row))).toEqual(['on_track', 'off', 'none']);
    expect(rows[0]?.querySelector('[data-track] svg')).not.toBeNull();
    expect(within(rows[0] as HTMLElement).getByText('Auf Kurs')).toBeDefined();
    expect(within(rows[2] as HTMLElement).getByText('Noch kein Wert')).toBeDefined();
    expect(rows[0]?.querySelector('[data-slot="sparkline"]')).not.toBeNull();
    expect(rows[2]?.querySelector('[data-slot="sparkline"]')).toBeNull();
    expect(screen.getByText(/Bis 10 % dahinter ist knapp/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Werte importieren' }).getAttribute('href')).toBe(
      `${base}/import`,
    );
  });

  it('die Kennzahl-Seite zeigt Werte, Verlauf und „Wert erfassen“ nur für die eigene Seite', async () => {
    renderAt(`${base}/${uuid(20)}`);
    expect(await screen.findByRole('heading', { level: 2, name: 'Werte' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Verlauf' })).toBeDefined();
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('93 %'),
      expect.stringContaining('91,5 %'),
    ]);
    expect(rows[0]?.textContent).toContain('Import');
    expect(screen.getByRole('link', { name: 'Wert erfassen' }).getAttribute('href')).toBe(
      `${base}/${uuid(20)}/wert`,
    );
    expect(screen.getByRole('link', { name: 'Bearbeiten' }).getAttribute('href')).toBe(
      `${base}/${uuid(20)}/bearbeiten`,
    );
  });

  it('bei einer Kennzahl der anderen Seite gibt es kein „Wert erfassen“', async () => {
    detail = { ...detail, kpi: current.kpis[1] as KpiDetail['kpi'] };
    renderAt(`${base}/${uuid(21)}`);
    expect(await screen.findByText('Werte erfasst die verantwortliche Seite.')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Wert erfassen' })).toBeNull();
  });

  it('Wert erfassen prüft die Zahl und schickt Monat und Wert', async () => {
    const router = renderAt(`${base}/${uuid(20)}/wert`);
    fireEvent.change(await screen.findByLabelText('Monat'), { target: { value: '2027-03' } });
    fireEvent.change(screen.getByLabelText(/^Wert in %/), { target: { value: 'gut' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Bitte eine Zahl eingeben, z. B. 97.5.')).toBeDefined();
    fireEvent.change(screen.getByLabelText(/^Wert in %/), { target: { value: '94,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${base}/${uuid(20)}`));
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: `/api/suppliers/${rel}/jbp/scorecard/kennzahlen/${uuid(20)}/werte`,
      body: { month: '2027-03', value: '94.5' },
    });
  });

  it('der Import zeigt die Vorschau mit markierten Fehlern und übernimmt erst ohne Fehler', async () => {
    preview = {
      rows: [
        { row: 2, kpi: 'Liefertreue', month: '2027-01', value: '91,5', errors: [] },
        { row: 3, kpi: 'Unbekannt', month: '2027-01', value: '90', errors: ['kennzahl_unbekannt'] },
      ],
      valid: 1,
      invalid: 1,
    };
    const router = renderAt(`${base}/import`);
    const input = (await screen.findByLabelText(/^Datei/)) as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['Kennzahl;Monat;Wert'], 'werte.csv', { type: 'text/csv' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau' }));
    expect(
      await screen.findByText('1 Zeilen in Ordnung, 1 fehlerhaft. Bitte die Datei korrigieren.'),
    ).toBeDefined();
    const bad = document.querySelector('[data-row="3"]') as HTMLElement;
    expect(bad.getAttribute('data-invalid')).toBe('true');
    expect(within(bad).getByText('Kennzahl unbekannt')).toBeDefined();
    expect(screen.queryByRole('button', { name: /übernehmen/ })).toBeNull();
    // Nach der Korrektur ist alles in Ordnung; erst dann gibt es „übernehmen“.
    preview = { rows: [preview.rows[0] as KpiImportPreview['rows'][number]], valid: 1, invalid: 0 };
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau' }));
    fireEvent.click(await screen.findByRole('button', { name: '1 Werte übernehmen' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(base));
    expect(sent.map((request) => request.url)).toEqual([
      `/api/suppliers/${rel}/jbp/scorecard/import/vorschau`,
      `/api/suppliers/${rel}/jbp/scorecard/import/vorschau`,
      `/api/suppliers/${rel}/jbp/scorecard/import`,
    ]);
  });
});
