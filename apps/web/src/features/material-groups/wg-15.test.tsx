// @vitest-environment jsdom
import type { StrategyContextResponse, StrategyStep, SupplierMap } from '@reziproq/shared';
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

// Tests zu docs/specs/WG-15.md in der Oberfläche: Supplier Map in Schritt 9. Ist-Anteil und Segment
// Ist sind Text, der Rest ist zusammengefasst und aufklappbar, der Soll-Typ nutzt nur Segmente aus
// SEG, ohne Zieljahr kommt die Meldung, fertig führt zur Übergabe an das Lieferantenmanagement.

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
const group = uuid(10);
const strategyId = uuid(60);
const rel = { big: uuid(80), mid: uuid(81), small: uuid(82) };
let map: SupplierMap;
let sent: { method: string; url: string; body: unknown }[];
let failWith: string | null;

const context: StrategyContextResponse = {
  year: 2027,
  hidden: false,
  canCreate: false,
  context: {
    group: {
      id: group,
      name: 'Leiterplatten',
      code: 'LP',
      lead: { userId: 'anna', name: 'Anna Schmidt' },
      spend: null,
      supplierCount: 3,
    },
    strategy: {
      id: strategyId,
      year: 2027,
      status: 'draft',
      version: 1,
      steps: [
        'done',
        'done',
        'done',
        'done',
        'done',
        'done',
        'done',
        'open',
        'in_progress',
        'open',
      ],
    },
    role: 'lead',
    editableSteps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
};
const content: StrategyStep = {
  step: 9,
  questions: [{ id: uuid(30), view: null, text: 'Welchen Soll-Typ strebt ihr an?' }],
  notes: [],
  milestones: [],
  leadSuggestion: null,
  dimensions: [],
  kpis: [],
  goals: [],
};
const types = [
  { impactLevel: 3, qualityLevel: 3, name: 'Hoher Impact · starke Beziehung' },
  { impactLevel: 3, qualityLevel: 2, name: 'Hoher Impact · ausbaufähige Beziehung' },
  { impactLevel: 2, qualityLevel: 2, name: 'Mittlerer Impact · ausbaufähige Beziehung' },
];
const row = (
  relationshipId: string,
  name: string,
  share: number,
  extra: Partial<SupplierMap['rows'][number]> = {},
): SupplierMap['rows'][number] => ({
  relationshipId,
  name,
  site: null,
  amountCents: Math.round(share * 10_000_000),
  share,
  shareTarget: null,
  targetYear: null,
  segmentIst: null,
  segmentTarget: null,
  feedbackGap: null,
  complete: false,
  ...extra,
});

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sent = [];
  failWith = null;
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  map = {
    canEdit: true,
    restricted: false,
    strategyYear: 2027,
    spendYear: 2025,
    currency: 'EUR',
    totalCents: 10_000_000,
    rows: [
      row(rel.big, 'Rheintal Elektronik', 0.6, {
        site: 'Speyer, DE',
        shareTarget: 52,
        targetYear: 2029,
        segmentIst: types[1] ?? null,
        segmentTarget: { kind: 'segment', ...(types[0] as (typeof types)[number]) },
        feedbackGap: { dimension: 'trust', delta: -0.9 },
        complete: true,
      }),
      row(rel.mid, 'Saar Circuits', 0.3, {
        segmentIst: types[2] ?? null,
        segmentTarget: { kind: 'segment', ...(types[2] as (typeof types)[number]) },
      }),
    ],
    rest: [row(rel.small, 'Donau Print', 0.1)],
    restCents: 1_000_000,
    restShare: 0.1,
    segmentTypes: types,
    complete: false,
    handoverRelationshipId: null,
  };
  api.handle = (request) => {
    if (request.url === `/api/warengruppen/${group}/strategie`) return Response.json(context);
    if (request.url.endsWith('/schritte/9')) return Response.json(content);
    if (request.url === `/api/warengruppen/strategien/${strategyId}/supplier-map`)
      return Response.json(map);
    if (request.method === 'PUT' && request.url.includes('/supplier-map/')) {
      sent.push(request);
      if (failWith) return Response.json({ statusCode: 400, code: failWith }, { status: 400 });
      return Response.json(map);
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('WG-15 Supplier Map', () => {
  it('zeigt Anteil Ist und Segment Ist als Text, den Rest zusammengefasst und aufklappbar', async () => {
    renderAt(`/warengruppen/${group}/strategie/9`);
    const table = await screen.findByRole('table', { name: 'Supplier Map' });
    const big = within(table).getByRole('row', { name: /Rheintal Elektronik/ });
    expect(within(big).getByText('60 %')).toBeTruthy();
    expect(within(big).getByText('52 %')).toBeTruthy();
    expect(within(big).getByText('Hoher Impact · ausbaufähige Beziehung')).toBeTruthy();
    expect(within(big).getByText('Hoher Impact · starke Beziehung · wechselt')).toBeTruthy();
    expect(within(big).getByText('Lücke 0,9')).toBeTruthy();
    // Nichts in der Zeile ist ein Eingabefeld für Ist-Werte
    expect(within(table).queryAllByRole('spinbutton')).toHaveLength(0);
    expect(
      within(big).getByRole('link', { name: 'Rheintal Elektronik' }).getAttribute('href'),
    ).toBe(`/lieferanten/${rel.big}`);
    // Rest zusammengefasst
    expect(within(table).queryByText('Donau Print')).toBeNull();
    const toggle = within(table).getByRole('button', { name: '1 weiteren zeigen' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(within(table).getByText('Donau Print')).toBeTruthy();
    // Nächster Schritt nennt den offenen Lieferanten
    expect(screen.getByRole('heading', { name: 'Soll für Saar Circuits festlegen' })).toBeTruthy();
    expect(
      screen.getByRole('img', { name: /Heute: Rheintal Elektronik 60 %, Saar Circuits 30 %/ }),
    ).toBeTruthy();
  });

  it('der Soll-Typ bietet nur Segmente aus SEG und „Beenden“; gespeichert wird mit Zieljahr', async () => {
    renderAt(`/warengruppen/${group}/strategie/9`);
    fireEvent.click(await screen.findByRole('button', { name: 'Soll bearbeiten: Saar Circuits' }));
    const form = screen.getByRole('form', { name: 'Soll für Saar Circuits' });
    const select = within(form).getByLabelText('Soll-Typ') as HTMLSelectElement;
    expect([...select.options].map((option) => option.text)).toEqual([
      'Bitte wählen',
      ...types.map((type) => type.name),
      'Beenden: Lieferant scheidet aus',
    ]);
    fireEvent.change(within(form).getByLabelText('Anteil Soll in Prozent'), {
      target: { value: '23' },
    });
    fireEvent.change(select, { target: { value: '3-2' } });
    fireEvent.change(within(form).getByLabelText('Zieljahr'), { target: { value: '2029' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        method: 'PUT',
        url: `/api/warengruppen/strategien/${strategyId}/supplier-map/${rel.mid}`,
        body: {
          site: null,
          shareTarget: 23,
          targetYear: 2029,
          segmentTarget: { kind: 'segment', impactLevel: 3, qualityLevel: 2 },
        },
      }),
    );
  });

  it('ohne Zieljahr meldet die Seite, dass kein Soll-Wert gespeichert wird', async () => {
    failWith = 'target_year_required';
    renderAt(`/warengruppen/${group}/strategie/9`);
    fireEvent.click(await screen.findByRole('button', { name: 'Soll bearbeiten: Saar Circuits' }));
    const form = screen.getByRole('form', { name: 'Soll für Saar Circuits' });
    fireEvent.change(within(form).getByLabelText('Anteil Soll in Prozent'), {
      target: { value: '23' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByText('Ohne Zieljahr kein Soll-Wert.')).toBeTruthy();
    expect(sent.at(-1)?.body).toMatchObject({ shareTarget: 23, targetYear: null });
  });

  it('fertig: Übergabe an das Lieferantenmanagement führt zum größten Lieferanten', async () => {
    map = { ...map, complete: true, handoverRelationshipId: rel.big };
    renderAt(`/warengruppen/${group}/strategie/9`);
    expect(
      await screen.findByRole('heading', { name: 'An das Lieferantenmanagement übergeben' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: /Übergeben/ }).getAttribute('href')).toBe(
      `/lieferanten/${rel.big}`,
    );
  });

  it('der SRO sieht im Entwurf nur seine Zeile, ohne Bearbeiten', async () => {
    map = { ...map, canEdit: false, restricted: true, rows: map.rest, rest: [] };
    renderAt(`/warengruppen/${group}/strategie/9`);
    expect(await screen.findByText(/Als SRO siehst du nur die Zeile/)).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Supplier Map' });
    expect(within(table).getByText('Donau Print')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Soll bearbeiten/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: /Umsatzverteilung/ })).toBeNull();
  });
});
