// @vitest-environment jsdom
import type { SpendOverview, SpendYearTotal } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spendChartData } from '@/components/charts/spend-chart';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/SPL-04.md in der Oberfläche: Daten des Diagramms (Plan-Jahre, feste
// Reihenfolge, Weitere, ohne Zuordnung), Kennzahlen, Umschalter in der Adresse, Erfassen.

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
const part = (n: number | null, amountCents: number) => ({
  id: n === null ? null : uuid(n),
  name: n === null ? null : `BU ${n}`,
  amountCents,
});
const year = (
  y: number,
  kind: 'actual' | 'plan',
  parts: ReturnType<typeof part>[],
): SpendYearTotal => ({
  year: y,
  kind,
  amountCents: parts.reduce((sum, entry) => sum + entry.amountCents, 0),
  byBusinessUnit: parts,
  byMaterialGroup: [
    part(
      null,
      parts.reduce((sum, entry) => sum + entry.amountCents, 0),
    ),
  ],
});
const labels = {
  unassigned: 'Ohne Zuordnung',
  more: 'Weitere',
  year: (y: number, kind: string) => (kind === 'plan' ? `${y} Plan` : String(y)),
};

const overview: SpendOverview = {
  currency: 'EUR',
  otherCurrencies: [],
  years: [
    year(2024, 'actual', [part(10, 80_00)]),
    year(2025, 'actual', [part(10, 60_00), part(11, 40_00)]),
    year(2026, 'plan', [part(10, 120_00)]),
  ],
  kpis: {
    year: 2025,
    amount: { amountCents: 100_00, currency: 'EUR' },
    previous: { amountCents: 80_00, currency: 'EUR' },
    changeBasisPoints: 2500,
    shareBasisPoints: 1234,
  },
  entries: [],
  options: { businessUnits: [{ id: uuid(10), name: 'BU 10' }], materialGroups: [] },
  canEdit: true,
};
const detail = {
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
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  api.handle = (request) => {
    if (request.method !== 'GET') sent.push(request);
    if (request.url === `/api/suppliers/${rel}`) return Response.json(detail);
    if (request.url.startsWith(`/api/suppliers/${rel}/spend`)) {
      return Response.json(overview, { status: request.method === 'POST' ? 201 : 200 });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const base = `/lieferanten/${rel}/strategie/spend`;

describe('SPL-04 Spend-Entwicklung in der Oberfläche', () => {
  it('das Diagramm stapelt je Jahr; Plan-Jahre sind beschriftet, ein Jahr mit Ist zeigt das Ist', () => {
    const { rows, series } = spendChartData(
      [...overview.years, year(2025, 'plan', [part(10, 999_00)])],
      'bu',
      labels,
    );
    expect(rows.map((row) => [row.label, row.kind, row.total])).toEqual([
      ['2024', 'actual', 80_00],
      ['2025', 'actual', 100_00],
      ['2026 Plan', 'plan', 120_00],
    ]);
    // Feste Reihenfolge nach Summe über alle Jahre, nicht nach Rang im Jahr.
    expect(series.map((entry) => entry.name)).toEqual(['BU 10', 'BU 11']);
    expect(rows[1]).toMatchObject({ [`s-${uuid(10)}`]: 60_00, [`s-${uuid(11)}`]: 40_00 });
  });

  it('mehr als vier Anteile fallen unter „Weitere“, Zeilen ohne Zuordnung bleiben eigen', () => {
    const { series, rows } = spendChartData(
      [
        year(
          2025,
          'actual',
          [1, 2, 3, 4, 5, 6].map((n) => part(n, n * 100)).concat(part(null, 50)),
        ),
      ],
      'bu',
      labels,
    );
    expect(series.map((entry) => entry.name)).toEqual([
      'BU 6',
      'BU 5',
      'BU 4',
      'BU 3',
      'Weitere',
      'Ohne Zuordnung',
    ]);
    expect(rows[0]?.more).toBe(300);
    expect(rows[0]?.unassigned).toBe(50);
  });

  it('Kennzahlen, Summen je Jahr mit Ist und Plan, Umschalter in der Adresse', async () => {
    const router = renderAt(base);
    const kpis = await screen.findByRole('region', { name: 'Kennzahlen' });
    expect(kpis.textContent?.replaceAll(' ', ' ')).toContain('100,00 €');
    expect(kpis.textContent).toContain('+25 %');
    expect(kpis.textContent).toContain('12,3 %');
    const totals = screen.getByRole('table', { name: 'Summen je Jahr' });
    expect(within(totals).getAllByRole('row')[1]?.textContent).toContain('2026Plan');
    expect(screen.getByText(/Plan-Jahre sind hell, gestrichelt umrandet/)).toBeDefined();
    fireEvent.click(screen.getByRole('radio', { name: 'Warengruppe' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ nach: 'warengruppe' }));
  });

  it('ein Plan-Eintrag je Business Unit wird erfasst; Ist weit in der Zukunft nicht', async () => {
    const router = renderAt(`${base}/neu`);
    const future = String(new Date().getFullYear() + 5);
    fireEvent.change(await screen.findByLabelText('Jahr'), { target: { value: future } });
    fireEvent.change(screen.getByLabelText('Spend in Euro', { exact: false }), {
      target: { value: '1.200' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText(/Plan bis zehn Jahre voraus/)).toBeDefined();
    expect(sent).toEqual([]);
    fireEvent.change(screen.getByLabelText('Art'), { target: { value: 'plan' } });
    fireEvent.change(screen.getByLabelText('Business Unit'), { target: { value: uuid(10) } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(base));
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: `/api/suppliers/${rel}/spend/eintraege`,
      body: {
        year: Number(future),
        kind: 'plan',
        businessUnitId: uuid(10),
        materialGroupId: null,
        amountCents: 1_200_00,
        currency: 'EUR',
      },
    });
  });
});
