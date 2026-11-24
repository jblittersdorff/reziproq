// @vitest-environment jsdom
import type { Kpi, ScorecardView } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/JBP-07.md in der Oberfläche: Tabelle mit Ziel, Termin, Verantwortlichen und
// „Nutzen für“; höchstens zehn Kennzahlen; Unterschreiben auf eigener Seite; gesperrt nach beiden.

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
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  current = view();
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
    if (request.url.startsWith(`/api/suppliers/${rel}/jbp/scorecard`)) {
      if (request.method !== 'GET') sent.push(request);
      return Response.json(current, { status: request.method === 'POST' ? 201 : 200 });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

const base = `/lieferanten/${rel}/plan/scorecard`;

describe('JBP-07 Scorecard in der Oberfläche', () => {
  it('die Tabelle zeigt Basis, Ziel, Termin, Verantwortliche und „Nutzen für“', async () => {
    renderAt(base);
    const table = (await screen.findByRole('table')) as HTMLElement;
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]?.textContent).toContain('Liefertreue');
    expect(rows[0]?.textContent).toContain('höher ist besser · Zweitquelle');
    expect(rows[0]?.textContent).toContain('91,5 %');
    expect(rows[0]?.textContent).toContain('98 %');
    expect(rows[0]?.textContent).toContain('31.12.2027');
    expect(rows[0]?.textContent).toContain('beide');
    expect(rows[1]?.textContent).toContain('Kim Kaiser');
    // Jede Kennzahl führt zu ihrer Seite; Bearbeiten steht dort (JBP-09).
    expect(
      within(rows[1] as HTMLElement)
        .getByRole('link', { name: 'Reklamationsquote' })
        .getAttribute('href'),
    ).toBe(`${base}/${uuid(21)}`);
    // Oben Status, Frist und die Unterschriften beider Seiten.
    const head = document.querySelector('[data-slot="scorecard-status"]') as HTMLElement;
    expect(head.textContent).toContain('Noch nicht unterschrieben');
    expect(head.textContent).toContain('Unterschreiben bis 08.01.2027');
    expect(within(head).getByRole('link', { name: 'Unterschreiben' }).getAttribute('href')).toBe(
      `${base}/unterschreiben`,
    );
  });

  it('bei zehn Kennzahlen gibt es keine elfte, mit Hinweis', async () => {
    current = view({ kpis: Array.from({ length: 10 }, (_, index) => kpi(30 + index)) });
    renderAt(base);
    expect(
      await screen.findByText(
        'Zehn Kennzahlen sind das Maximum. Entfernt eine, bevor ihr eine neue vorschlagt.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Neue Kennzahl' })).toBeNull();
    expect(screen.getByText('10 von 10 Kennzahlen')).toBeDefined();
  });

  it('eine neue Kennzahl braucht Ziel, Termin und Verantwortliche; Zahlen mit Komma gehen', async () => {
    const router = renderAt(`${base}/neu`);
    fireEvent.click(await screen.findByRole('button', { name: 'Kennzahl anlegen' }));
    expect(await screen.findAllByText('Bitte ausfüllen.')).toHaveLength(5);
    fireEvent.change(screen.getByLabelText(/^Kennzahl/), { target: { value: 'Liefertreue' } });
    fireEvent.change(screen.getByLabelText(/^Einheit/), { target: { value: '%' } });
    fireEvent.change(screen.getByLabelText(/^Ziel/), { target: { value: 'viel' } });
    fireEvent.change(screen.getByLabelText('Termin'), { target: { value: '2027-12-31' } });
    fireEvent.change(screen.getByLabelText('Verantwortlich'), { target: { value: 'sara' } });
    fireEvent.change(screen.getByLabelText('Nutzen für'), { target: { value: 'buyer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kennzahl anlegen' }));
    expect(await screen.findByText('Bitte eine Zahl eingeben, z. B. 97.5.')).toBeDefined();
    fireEvent.change(screen.getByLabelText(/^Ziel/), { target: { value: '97,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Kennzahl anlegen' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(base));
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: `/api/suppliers/${rel}/jbp/scorecard/kennzahlen`,
      body: {
        name: 'Liefertreue',
        target: '97.5',
        baseline: null,
        targetDate: '2027-12-31',
        ownerUserId: 'sara',
        benefitFor: 'buyer',
      },
    });
  });

  it('unterschreiben bestätigt man auf eigener Seite', async () => {
    const router = renderAt(`${base}/unterschreiben`);
    fireEvent.click(await screen.findByRole('button', { name: 'Für unsere Seite unterschreiben' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(base));
    expect(sent[0]?.url).toBe(`/api/suppliers/${rel}/jbp/scorecard/unterschreiben`);
  });

  it('nach beiden Unterschriften ist die Scorecard gesperrt; eine neue Version ist möglich', async () => {
    current = view({
      status: 'signed',
      canEdit: false,
      canSign: false,
      canNewVersion: true,
      signatures: [
        { side: 'buyer', userName: 'Sara Ost', signedAt: '2026-11-09T10:00:00Z' },
        { side: 'supplier', userName: 'Kim Kaiser', signedAt: '2026-11-10T10:00:00Z' },
      ],
    });
    renderAt(base);
    expect(await screen.findByText('Von beiden unterschrieben')).toBeDefined();
    expect(screen.getByText(/gesperrt/)).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Neue Kennzahl' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Neue Kennzahl' })).toBeNull();
    expect(document.querySelector('[data-signature="supplier"]')?.textContent).toContain(
      'Kim Kaiser',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Neue Version starten' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Neue Version starten' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]?.url).toBe(`/api/suppliers/${rel}/jbp/scorecard/neue-version`);
  });
});
