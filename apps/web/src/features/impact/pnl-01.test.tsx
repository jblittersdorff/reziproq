// @vitest-environment jsdom
import type { ImpactDetail, ImpactList, PnlLines } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/PNL-01.md und PNL-03.md in der Oberfläche: Liste, nur erlaubte
// Wirkungsarten, Baseline in Euro mit Einfrieren, Reifegrad nur mit Nachweis.

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
const initiativeId = uuid(20);
const lines: PnlLines = {
  canManage: true,
  lines: [
    { key: 'material', name: 'Materialaufwand', position: 2, active: true },
    { key: 'logistics', name: 'Logistikkosten', position: 4, active: true },
    { key: 'alt', name: 'Alte Zeile', position: 9, active: false },
  ],
};
const list: ImpactList = {
  canEdit: true,
  initiatives: [
    {
      id: initiativeId,
      title: 'Preis Leiterplatten',
      source: 'jbp',
      maturity: 2,
      impact: {
        lever: 'price',
        leverTemplateVersion: 1,
        pnlLine: { key: 'material', name: 'Materialaufwand' },
        effectType: 'ebit',
        effectiveFrom: null,
      },
    },
    { id: uuid(21), title: 'Idee Verpackung', source: 'supplier_idea', maturity: 1, impact: null },
  ],
};
const detail = (extra: Partial<ImpactDetail> = {}): ImpactDetail => ({
  initiative: {
    id: initiativeId,
    title: 'Preis Leiterplatten',
    source: 'jbp',
    startsOn: '2027-01-01',
  },
  impact: list.initiatives[0]?.impact ?? null,
  baselines: [],
  maturity: { level: 1, steps: [] },
  next: { toLevel: 2, requirement: 'baseline', ready: false, decisions: [] },
  canEdit: true,
  ...extra,
});
let current: ImpactDetail;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  current = detail();
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
    if (request.url === '/api/pnl-lines') return Response.json(lines);
    if (request.url === `/api/suppliers/${rel}/wirkung`) return Response.json(list);
    if (request.url.startsWith(`/api/suppliers/${rel}/wirkung/initiativen/`)) {
      if (request.method !== 'GET') sent.push(request);
      return Response.json(current, { status: request.method === 'POST' ? 201 : 200 });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const base = `/lieferanten/${rel}/wirkung/initiativen`;

describe('PNL-01, PNL-03 Wirkung in der Oberfläche', () => {
  it('die Liste zeigt Quelle, Hebel, GuV-Zeile, Wirkungsart und Reifegrad', async () => {
    renderAt(base);
    const table = (await screen.findByRole('table')) as HTMLElement;
    const row = within(table).getByRole('link', { name: 'Preis Leiterplatten' }).closest(
      'tr',
    ) as HTMLElement;
    expect(row.textContent).toContain('Gemeinsamer Plan');
    expect(row.textContent).toContain('Preis');
    expect(row.textContent).toContain('Materialaufwand');
    expect(row.textContent).toContain('EBIT');
    expect(row.textContent).toContain('R2 Bewertet');
    const idea = within(table).getByRole('link', { name: 'Idee Verpackung' }).closest('tr') as HTMLElement;
    expect(idea.textContent).toContain('Idee des Lieferanten');
    expect(idea.textContent).toContain('Noch keine Wirkung');
  });

  it('Wirkung einrichten bietet nur erlaubte Wirkungsarten und aktive GuV-Zeilen an', async () => {
    current = detail({ impact: null, next: null });
    const router = renderAt(`${base}/${initiativeId}/einrichten`);
    const lever = (await screen.findByLabelText('Hebel')) as HTMLSelectElement;
    const effect = screen.getByLabelText(/^Wirkungsart/) as HTMLSelectElement;
    expect([...effect.options].map((option) => option.value)).toEqual(['ebit']);
    expect(
      screen.getByText('Rechenregel (Version 1): (Preis alt − Preis neu) × Menge'),
    ).toBeDefined();
    fireEvent.change(lever, { target: { value: 'logistics' } });
    expect([...effect.options].map((option) => option.value)).toEqual(['ebit', 'cost_avoidance']);
    fireEvent.change(lever, { target: { value: 'working_capital' } });
    expect(effect.value).toBe('cash');
    const line = screen.getByLabelText('GuV-Zeile') as HTMLSelectElement;
    await waitFor(() => expect(line.options.length).toBe(3));
    expect([...line.options].map((option) => option.textContent)).not.toContain('Alte Zeile');
    fireEvent.change(line, { target: { value: 'material' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${base}/${initiativeId}`));
    expect(sent[0]?.body).toEqual({
      lever: 'working_capital',
      pnlLineKey: 'material',
      effectType: 'cash',
      effectiveFrom: null,
    });
  });

  it('die Baseline nimmt Euro, speichert Cent und friert erst nach Bestätigung ein', async () => {
    const router = renderAt(`${base}/${initiativeId}/baseline`);
    fireEvent.change(await screen.findByLabelText('Preis alt in € je Stück'), {
      target: { value: '12,34' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Einfrieren' }));
    expect(sent).toEqual([]);
    fireEvent.click(await screen.findByRole('button', { name: 'Einfrieren' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${base}/${initiativeId}`));
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: `/api/suppliers/${rel}/wirkung/initiativen/${initiativeId}/baseline`,
      body: { inputs: { price_old: '1234' }, changeReason: null },
    });
  });

  it('eine neue Baseline-Version verlangt eine Begründung', async () => {
    current = detail({
      baselines: [
        {
          version: 1,
          leverTemplateVersion: 1,
          inputs: { price_old: '1234' },
          frozenAt: '2027-02-01T10:00:00Z',
          frozenByName: 'Sara Ost',
          changeReason: null,
        },
      ],
    });
    renderAt(`${base}/${initiativeId}/baseline`);
    fireEvent.change(await screen.findByLabelText('Preis alt in € je Stück'), {
      target: { value: '12,50' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Einfrieren' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Einfrieren' }));
    expect(await screen.findByText('Bitte ausfüllen.')).toBeDefined();
    expect(sent).toEqual([]);
  });

  it('die Wirkungs-Seite zeigt Reifegrad, Baseline (intern) und Stufen', async () => {
    current = detail({
      baselines: [
        {
          version: 1,
          leverTemplateVersion: 1,
          inputs: { price_old: '1234' },
          frozenAt: '2027-02-01T10:00:00Z',
          frozenByName: 'Sara Ost',
          changeReason: null,
        },
      ],
      maturity: {
        level: 2,
        steps: [
          {
            fromLevel: 1,
            toLevel: 2,
            evidence: 'Baseline Version 1 eingefroren',
            evidenceLink: null,
            decidedByName: 'Sara Ost',
            decidedAt: '2027-02-01T10:00:00Z',
          },
        ],
      },
      next: { toLevel: 3, requirement: 'decision', ready: true, decisions: [] },
    });
    renderAt(`${base}/${initiativeId}`);
    const ladder = (await screen.findByRole('list', { name: 'Reifegrad' })) as HTMLElement;
    expect(ladder.querySelector('[aria-current="step"]')?.textContent).toBe('R2 Bewertet');
    const baseline = screen
      .getByRole('heading', { level: 2, name: 'Baseline' })
      .closest('section') as HTMLElement;
    expect(baseline.querySelector('[data-visibility="internal"]')).not.toBeNull();
    expect(baseline.textContent).toMatch(/12,34\s€/);
    expect(screen.getByText('Baseline Version 1 eingefroren')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Auf R3 erhöhen' }).getAttribute('href')).toBe(
      `${base}/${initiativeId}/reifegrad`,
    );
  });

  it('der Reifegrad steigt nur mit Nachweis; ohne Nachweis ist Speichern gesperrt', async () => {
    renderAt(`${base}/${initiativeId}/reifegrad`);
    expect(await screen.findByText('Nachweis: eine eingefrorene Baseline.')).toBeDefined();
    expect(screen.getByText('Der Nachweis fehlt noch.')).toBeDefined();
    expect(
      (screen.getByRole('button', { name: /Auf R2 erhöhen/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('R4 verlangt Datum und Nachweis', async () => {
    current = detail({
      maturity: { level: 3, steps: [] },
      next: { toLevel: 4, requirement: 'implementation', ready: true, decisions: [] },
    });
    const router = renderAt(`${base}/${initiativeId}/reifegrad`);
    fireEvent.click(await screen.findByRole('button', { name: /Auf R4 erhöhen/ }));
    expect(await screen.findAllByText('Bitte ausfüllen.')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Umgesetzt am'), { target: { value: '2027-04-01' } });
    fireEvent.change(screen.getByLabelText('Nachweis'), {
      target: { value: 'Neuer Rahmenvertrag' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Auf R4 erhöhen/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`${base}/${initiativeId}`));
    expect(sent[0]?.body).toMatchObject({
      toLevel: 4,
      implementedOn: '2027-04-01',
      evidence: 'Neuer Rahmenvertrag',
    });
  });

  it('R5 vergibt nur die Freigabe durch Controlling', async () => {
    current = detail({
      maturity: { level: 4, steps: [] },
      next: { toLevel: 5, requirement: 'validation', ready: false, decisions: [] },
    });
    renderAt(`${base}/${initiativeId}`);
    expect(await screen.findByText('R5 vergibt nur die Freigabe durch Controlling.')).toBeDefined();
    expect(screen.queryByRole('link', { name: /Auf R5/ })).toBeNull();
    const ladder = screen.getByRole('list', { name: 'Reifegrad' });
    expect(within(ladder).getAllByRole('listitem')).toHaveLength(5);
  });
});
