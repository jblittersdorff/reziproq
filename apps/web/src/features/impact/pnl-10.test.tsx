// @vitest-environment jsdom

import type { Bridge, PortfolioImpact, SecuredResults } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildInitiativeBridge } from '@/components/charts/bridge';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';
import { expectPageLimits } from '@/testing/page-limits';

// Tests zu docs/specs/PNL-10.md in der Oberfläche: Brücke nur mit EBIT, Summe am Ende, andere Arten
// daneben; Portfolio mit Pipeline je Wirkungsart ohne Gesamtsumme; Sicht und Geschäftsjahr in der
// Adresse; jede Zeile führt zur Beziehung bzw. Initiative.

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
const bridge: Bridge = {
  view: 'jahreswirkung',
  fiscalYear: 2026,
  fiscalYearStartMonth: 4,
  fiscalYears: [2025, 2026],
  steps: [
    { initiativeId: uuid(10), title: 'Preis', maturity: 3, amountCents: 68_00 },
    { initiativeId: uuid(11), title: 'Qualität', maturity: 5, amountCents: 10_00 },
  ],
  ebitTotal: 78_00,
  others: [{ effectType: 'cost_avoidance', amountCents: 20_00 }],
  excluded: [{ initiativeId: uuid(12), title: 'Im Savings-Tracking' }],
};
const portfolio: PortfolioImpact = {
  view: 'jahreswirkung',
  fiscalYear: 2026,
  fiscalYearStartMonth: 4,
  fiscalYears: [2025, 2026],
  focusSuppliers: 2,
  pipeline: [
    {
      effectType: 'ebit',
      levels: [1, 2, 3, 4, 5].map((level) => ({ level, amountCents: level === 3 ? 68_00 : 0 })),
    },
    {
      effectType: 'cost_avoidance',
      levels: [1, 2, 3, 4, 5].map((level) => ({ level, amountCents: level === 1 ? 20_00 : 0 })),
    },
  ],
  businessUnits: {
    years: [2025, 2026, 2027],
    rows: [{ id: uuid(20), name: 'Pkw', amounts: [34_00, 68_00, 0] }],
  },
  top: [{ relationshipId: rel, name: 'Rheintal Elektronik GmbH (Demo)', realizedCents: 10_00 }],
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
let requests: string[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = [...actionsFor.admin, 'wirkung.sehen'];
  requests = [];
  api.handle = (request) => {
    requests.push(request.url);
    if (request.url === `/api/suppliers/${rel}`) return Response.json(detail);
    if (request.url.startsWith(`/api/suppliers/${rel}/wirkung/bruecke`))
      return Response.json(bridge);
    if (request.url.startsWith('/api/wirkung/portfolio')) return Response.json(portfolio);
    if (request.url.startsWith('/api/wirkung/freigaben')) return Response.json({ validations: [] });
    return undefined;
  };
});

afterEach(tearDownApp);

describe('PNL-10 in der Oberfläche', () => {
  it('die Brücke hat je Initiative einen Schritt nach Reifegrad und am Ende die Summe', () => {
    const steps = buildInitiativeBridge(
      bridge.steps.map((step) => ({
        label: step.title,
        amountCents: step.amountCents,
        maturity: step.maturity,
      })),
      'Summe EBIT',
    );
    expect(
      steps.map((step) => [step.label, step.startCents, step.endCents, step.maturity]),
    ).toEqual([
      ['Preis', 0, 68_00, 3],
      ['Qualität', 68_00, 78_00, 5],
      ['Summe EBIT', 0, 78_00, undefined],
    ]);
  });

  it('die Brücke zeigt EBIT je Initiative mit Weg zur Initiative, andere Arten daneben, Savings-Tracking ausgenommen', async () => {
    renderAt(`/lieferanten/${rel}/wirkung/bruecke`);
    const table = await screen.findByRole('table', { name: 'Initiativen in der Brücke' });
    const link = within(table).getByRole('link', { name: 'Preis' });
    expect(link.getAttribute('href')).toBe(`/lieferanten/${rel}/wirkung/initiativen/${uuid(10)}`);
    expect(within(table).getAllByRole('row')[1]?.textContent).toContain('R3');
    const others = screen.getByRole('list', { name: 'Andere Wirkungsarten, nicht in der Brücke' });
    expect(
      within(others)
        .getAllByRole('listitem')
        .map((item) => item.getAttribute('data-effect')),
    ).toEqual(['cost_avoidance']);
    expect(
      screen.getByText(/Bereits im Savings-Tracking, in keiner Summe: Im Savings-Tracking/),
    ).toBeDefined();
  });

  it('AW-01: oben die Brücke nur aus bestätigten Werten mit „Gesichert“ als Summe, offene Monate in der Tinte-Karte', async () => {
    const secured: SecuredResults = {
      fiscalYear: 2026,
      fiscalYears: [2026],
      currency: 'EUR',
      steps: [{ initiativeId: uuid(10), title: 'Preis', maturity: 4, securedCents: 30_000_00 }],
      securedEbitCents: 30_000_00,
      target: { ebitTargetCents: 60_000_00, approved: true },
      pending: { months: 2, initiatives: 1, amountCents: 10_000_00 },
      others: [{ effectType: 'cash', securedCents: 5_000_00 }],
      statement: null,
    };
    const handle = api.handle;
    api.handle = (request) =>
      request.url.startsWith(`/api/suppliers/${rel}/ergebnisse/gesichert`)
        ? Response.json(secured)
        : handle?.(request);
    renderAt(`/lieferanten/${rel}/wirkung/bruecke`);
    const table = await screen.findByRole('table', { name: 'Gesicherter Beitrag je Initiative' });
    expect(within(table).getAllByRole('row')[1]?.textContent).toContain('30.000,00');
    expect(screen.getByText(/Gesichert: 30\.000,00 € von 60\.000,00 € EBIT/)).toBeDefined();
    expect(
      screen.getByRole('heading', { name: '2 Monate warten auf das Controlling' }),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: /Freigaben ansehen/ }).getAttribute('href')).toBe(
      '/wirkung/freigaben',
    );
    expect(screen.getByText(/nie zum EBIT addiert: Cash 5\.000,00/)).toBeDefined();
    // Plan und Ist bleiben darunter
    expect(screen.getByRole('heading', { name: 'Plan und Ist nach Reifegrad' })).toBeDefined();
    expectPageLimits();
  });

  it('das Portfolio zeigt die Pipeline je Wirkungsart ohne Gesamtsumme und führt zur Beziehung', async () => {
    renderAt('/uebersicht/ergebnisse');
    expect(await screen.findByText(/2 Fokuslieferanten/)).toBeDefined();
    expect(screen.getByRole('list', { name: 'EBIT' })).toBeDefined();
    expect(screen.getByRole('list', { name: 'Kostenvermeidung' })).toBeDefined();
    expect(document.body.textContent?.replaceAll(' ', ' ')).not.toContain('88,00');
    const table = screen.getByRole('table', { name: 'EBIT-Wirkung je Business Unit' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Business Unit', 'GJ 2025/26', 'GJ 2026/27', 'GJ 2027/28']);
    const top = screen.getByRole('list', {
      name: 'Top-Beziehungen nach realisierter EBIT-Wirkung',
    });
    expect(within(top).getByRole('link').getAttribute('href')).toBe(
      `/lieferanten/${rel}/wirkung/bruecke`,
    );
  });

  it('Sicht und Geschäftsjahr stehen in der Adresse und gehen an die API', async () => {
    const router = renderAt('/uebersicht/ergebnisse');
    fireEvent.click(await screen.findByRole('radio', { name: 'Geschäftsjahr' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ sicht: 'geschaeftsjahr', gj: 2026 }),
    );
    await waitFor(() =>
      expect(requests).toContain('/api/wirkung/portfolio?sicht=geschaeftsjahr&gj=2026'),
    );
  });
});
