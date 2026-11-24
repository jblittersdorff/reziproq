// @vitest-environment jsdom
import type { ImpactDetail, ValidationDetail, ValidationList } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/PNL-05.md und PNL-06.md in der Oberfläche: Monat in Euro erfassen, Import mit
// Vorschau, Freigabe anfordern, Prüfseite mit Rechenweg, Zurückweisen nur mit Begründung.

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
const initiativeId = uuid(20);
const validationId = uuid(30);
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
const impact = {
  lever: 'price' as const,
  leverTemplateVersion: 1,
  pnlLine: { key: 'material', name: 'Materialaufwand' },
  effectType: 'ebit' as const,
  effectiveFrom: null,
};
const baseline = {
  version: 1,
  leverTemplateVersion: 1,
  inputs: { price_old: '1234' },
  frozenAt: '2027-02-01T10:00:00Z',
  frozenByName: 'Sara Ost',
  changeReason: null,
};
const months: ImpactDetail['months'] = [
  {
    month: '2027-03-01',
    plan: null,
    actual: {
      inputs: { price_new: '1200', quantity: '1000' },
      amountCents: 34_000,
      enteredByName: 'Sara Ost',
      source: 'manual',
    },
    locked: false,
  },
];
const detail = (extra: Partial<ImpactDetail> = {}): ImpactDetail => ({
  initiative: {
    id: initiativeId,
    title: 'Preis Leiterplatten',
    source: 'jbp',
    startsOn: '2027-01-01',
  },
  impact,
  baselines: [baseline],
  maturity: { level: 4, steps: [] },
  next: { toLevel: 5, requirement: 'validation', ready: false, decisions: [] },
  canEdit: true,
  months,
  totals: { plan: 0, actual: 34_000 },
  validations: [],
  canRequestValidation: true,
  ...extra,
});
const validation = {
  id: validationId,
  relationshipId: rel,
  supplier: 'Rheintal Elektronik GmbH (Demo)',
  initiativeId,
  initiative: 'Preis Leiterplatten',
  periodFrom: '2027-03-01',
  periodTo: '2027-03-01',
  status: 'requested' as const,
  requestedByName: 'Sara Ost',
  requestedAt: '2027-04-02T09:00:00Z',
  decidedByName: null,
  decidedAt: null,
  comment: null,
};
const review = (canDecide: boolean): ValidationDetail => ({
  validation,
  impact,
  baseline,
  months,
  totals: { plan: 0, actual: 34_000 },
  maturity: {
    level: 4,
    steps: [
      {
        fromLevel: 3,
        toLevel: 4,
        evidence: 'Neuer Rahmenvertrag',
        evidenceLink: null,
        decidedByName: 'Sara Ost',
        decidedAt: '2027-03-01T10:00:00Z',
      },
    ],
  },
  canDecide,
});
let current: ImpactDetail;
let canDecide: boolean;
let sent: { method: string; url: string; body: unknown }[];
let preview: { status: number; body: unknown };

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = [...actionsFor.admin, 'wirkung.sehen', 'wirkung.bearbeiten'];
  sent = [];
  current = detail();
  canDecide = true;
  preview = { status: 200, body: { rows: [], valid: 0, invalid: 0 } };
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
    if (request.url.includes('/import')) {
      sent.push(request);
      return Response.json(preview.body, { status: preview.status });
    }
    if (request.url.startsWith(`/api/suppliers/${rel}/wirkung/initiativen/`)) {
      if (request.method !== 'GET') sent.push(request);
      return Response.json(current, { status: request.method === 'POST' ? 201 : 200 });
    }
    if (request.url === '/api/wirkung/freigaben') {
      const list: ValidationList = { validations: [validation], canDecide };
      return Response.json(list);
    }
    if (request.url.startsWith(`/api/wirkung/freigaben/${validationId}`)) {
      if (request.method !== 'GET') sent.push(request);
      return Response.json(review(canDecide), { status: request.method === 'POST' ? 201 : 200 });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const base = `/lieferanten/${rel}/wirkung/initiativen/${initiativeId}`;

describe('PNL-05, PNL-06 Monatswerte und Freigabe in der Oberfläche', () => {
  it('die Wirkungs-Seite zeigt Monate mit Eingaben, Betrag und Diagramm', async () => {
    renderAt(base);
    const section = (await screen.findByRole('heading', { level: 2, name: 'Monatswerte' })).closest(
      'section',
    ) as HTMLElement;
    const row = section.querySelector('[data-month="2027-03-01"]') as HTMLElement;
    expect(row.textContent).toMatch(/340,00\s€/);
    expect(row.textContent).toContain('Menge: 1.000');
    expect(within(section).getByRole('link', { name: 'Freigabe anfordern' })).toBeDefined();
  });

  it('ein Monat nimmt Euro und speichert Cent', async () => {
    const router = renderAt(`${base}/monat`);
    fireEvent.change(await screen.findByLabelText('Monat'), { target: { value: '2027-04' } });
    fireEvent.change(screen.getByLabelText('Preis neu in € je Stück'), {
      target: { value: '11,90' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Bitte ausfüllen.')).toBeDefined();
    expect(sent).toEqual([]);
    fireEvent.change(screen.getByLabelText('Menge'), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(base));
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: `/api/suppliers/${rel}/wirkung/initiativen/${initiativeId}/monate`,
      body: { month: '2027-04', kind: 'actual', inputs: { price_new: '1190', quantity: '1000' } },
    });
  });

  it('der Import zeigt fehlerhafte Zeilen und übernimmt dann nichts', async () => {
    preview = {
      status: 200,
      body: {
        rows: [
          { row: 2, month: '2027-03', kind: 'actual', inputs: {}, errors: [], fields: [] },
          {
            row: 3,
            month: '2027-13',
            kind: 'actual',
            inputs: {},
            errors: ['monat_ungueltig'],
            fields: [],
          },
        ],
        valid: 1,
        invalid: 1,
      },
    };
    renderAt(`${base}/import`);
    const file = new File(['Monat;Art'], 'werte.csv', { type: 'text/csv' });
    fireEvent.change(await screen.findByLabelText('Datei'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Vorschau' }));
    const list = await screen.findByRole('region', { name: 'Vorschau' });
    expect(list.querySelector('[data-row="3"][data-invalid]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Zeilen übernehmen/ })).toBeNull();
    expect(sent.map((entry) => entry.url)).toEqual([
      `/api/suppliers/${rel}/wirkung/initiativen/${initiativeId}/import/vorschau`,
    ]);
  });

  it('Freigabe anfordern schickt den Zeitraum der Ist-Monate', async () => {
    const router = renderAt(`${base}/freigabe`);
    fireEvent.click(await screen.findByRole('button', { name: 'Freigabe anfordern' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(base));
    expect(sent[0]).toMatchObject({
      url: `/api/suppliers/${rel}/wirkung/initiativen/${initiativeId}/freigabe`,
      body: { periodFrom: '2027-03', periodTo: '2027-03' },
    });
  });

  it('die Liste führt zur Prüfseite mit Regel, Baseline, Monaten und Nachweisen', async () => {
    const router = renderAt('/wirkung/freigaben');
    fireEvent.click(await screen.findByRole('link', { name: 'Preis Leiterplatten' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/wirkung/freigaben/${validationId}`),
    );
    expect(
      await screen.findByText(/Rechenregel \(Version 1\): \(Preis alt − Preis neu\) × Menge/),
    ).toBeDefined();
    expect(
      (screen.getByRole('heading', { name: 'Baseline' }).closest('section') as HTMLElement)
        .textContent,
    ).toMatch(/12,34\s€/);
    const table = screen.getByRole('table');
    expect(table.querySelector('[data-month="2027-03-01"]')?.textContent).toMatch(/340,00\s€/);
    expect(screen.getByText('Neuer Rahmenvertrag')).toBeDefined();
  });

  it('Zurückweisen verlangt eine Begründung; Freigeben schickt die Entscheidung', async () => {
    renderAt(`/wirkung/freigaben/${validationId}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Zurückweisen' }));
    expect(await screen.findByText('Bitte ausfüllen.')).toBeDefined();
    expect(sent).toEqual([]);
    fireEvent.change(screen.getByLabelText('Begründung'), {
      target: { value: 'Menge nicht belegt' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Zurückweisen' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      url: `/api/wirkung/freigaben/${validationId}/entscheiden`,
      body: { decision: 'rejected', comment: 'Menge nicht belegt' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Freigeben' }));
    await waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]?.body).toEqual({ decision: 'approved', comment: null });
  });

  it('ohne Zusatzrolle Controlling gibt es keine Entscheidung', async () => {
    canDecide = false;
    renderAt(`/wirkung/freigaben/${validationId}`);
    expect(
      await screen.findByText('Freigeben darf nur, wer die Zusatzrolle Controlling hat.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Freigeben' })).toBeNull();
  });
});
