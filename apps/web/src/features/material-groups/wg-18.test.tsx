// @vitest-environment jsdom
import type { CategorySegmentation, PortfolioMatrix, SuppliersResponse } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spendBySegment } from '@/features/portfolio/matrix-page';
import {
  actionsFor,
  anna,
  api,
  renderAt,
  sampleSuppliers,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';

// Tests zu docs/specs/WG-18.md in der Oberfläche: Runde starten mit vorgewählten Lieferanten und
// Team, Segment festlegen nur aus eingestellten Segmenten, Portfolio-Filter mit Titel, Umschalter
// und „Spend nach Segment“, „Zu klären“ mit jüngerer Entscheidung in der Warengruppe.

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
const group = uuid(10);
const typed = (impactLevel: number, qualityLevel: number, typeName: string) => ({
  impactLevel,
  qualityLevel,
  typeName,
});
const types = [
  { impactLevel: 3, qualityLevel: 3, name: 'Strategisch' },
  { impactLevel: 2, qualityLevel: 2, name: 'Entwickeln' },
  { impactLevel: 1, qualityLevel: 1, name: 'Routine' },
];
let segmentation: CategorySegmentation;
let sent: { method: string; url: string; body: unknown }[];

const supplier = (n: number, name: string, spendCents: number) => ({
  relationshipId: uuid(n),
  name,
  spendCents,
  currency: 'EUR',
  rateable: true,
  ratings: { submitted: 0, total: 0 },
  suggestion: null,
  decision: null,
  overall: null,
});

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sent = [];
  api.me = { ...anna, orgRole: 'member' };
  api.permissions = actionsFor.member;
  segmentation = {
    group: { id: group, name: 'Leiterplatten' },
    spendYear: 2025,
    canManage: true,
    round: null,
    types,
    raters: [
      { userId: 'anna', name: 'Anna Schmidt', function: 'purchasing' },
      { userId: 'ben', name: 'Ben Berg', function: 'quality' },
    ],
    suppliers: [
      supplier(20, 'Rheintal Elektronik', 3_000_000),
      { ...supplier(21, 'Moldau PCB', 1_000_000), rateable: false },
    ],
  };
  api.handle = (request) => {
    if (request.url === `/api/warengruppen/${group}/segmentierung`) {
      return Response.json(segmentation);
    }
    if (request.method === 'POST' && request.url.startsWith(`/api/warengruppen/${group}/`)) {
      sent.push(request);
      return Response.json(segmentation, { status: 201 });
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('WG-18 Segmentierung je Warengruppe', () => {
  it('der Lead startet die Runde: Lieferanten vorgewählt, Team als Bewertende', async () => {
    renderAt(`/warengruppen/${group}/segmentierung`);
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Segmente in der Warengruppe festlegen',
      }),
    ).toBeTruthy();
    const form = await screen.findByRole('form', {
      name: 'Bewertungsrunde für die Warengruppe starten',
    });
    const rheintal = within(form).getByRole('checkbox', { name: /Rheintal Elektronik/ });
    const moldau = within(form).getByRole('checkbox', { name: /Moldau PCB/ });
    expect((rheintal as HTMLInputElement).checked).toBe(true);
    expect((moldau as HTMLInputElement).disabled).toBe(true);
    expect(within(form).getByText('ohne Business Unit, nicht bewertbar')).toBeTruthy();
    expect(within(form).getByText('Anna Schmidt (Einkauf), Ben Berg (Qualität)')).toBeTruthy();
    fireEvent.change(within(form).getByLabelText('Frist'), { target: { value: '2099-06-30' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Runde starten' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        url: `/api/warengruppen/${group}/runden`,
        body: { dueDate: '2099-06-30', relationshipIds: [uuid(20)] },
      }),
    );
  });

  it('festlegen bietet nur die eingestellten Segmente und verlangt eine Begründung', async () => {
    segmentation = {
      ...segmentation,
      round: {
        id: uuid(30),
        name: 'Segmentierung',
        dueDate: '2099-06-30',
        status: 'open',
        submitted: 2,
        total: 2,
      },
      suppliers: [
        {
          ...supplier(20, 'Rheintal Elektronik', 3_000_000),
          ratings: { submitted: 2, total: 2 },
          suggestion: { ist: typed(2, 2, 'Entwickeln'), soll: typed(3, 3, 'Strategisch') },
          overall: { ist: typed(1, 1, 'Routine'), soll: typed(1, 1, 'Routine') },
        },
      ],
    };
    renderAt(`/warengruppen/${group}/segmentierung`);
    expect(await screen.findByText(/2 von 2 Bewertungen abgegeben/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Runde starten' })).toBeNull();
    expect(screen.getByText('Vorschlag aus der Runde: Entwickeln → Strategisch')).toBeTruthy();
    expect(screen.getByText('Gesamt: Routine → Routine')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Segment festlegen: Rheintal Elektronik' }));
    const form = screen.getByRole('form', { name: 'Segment für Rheintal Elektronik' });
    const ist = within(form).getByLabelText('Segment Ist') as HTMLSelectElement;
    expect([...ist.options].map((option) => option.text)).toEqual([
      'Strategisch',
      'Entwickeln',
      'Routine',
    ]);
    expect(ist.value).toBe('2-2');
    fireEvent.click(within(form).getByRole('button', { name: 'Festlegen' }));
    expect(await within(form).findByText('Bitte eine Begründung eintragen.')).toBeTruthy();
    expect(sent).toEqual([]);
    fireEvent.change(within(form).getByLabelText('Begründung'), {
      target: { value: 'Im Team besprochen' },
    });
    fireEvent.click(within(form).getByRole('button', { name: 'Festlegen' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        url: `/api/warengruppen/${group}/segmente/${uuid(20)}`,
        body: {
          ist: { impactLevel: 2, qualityLevel: 2 },
          soll: { impactLevel: 3, qualityLevel: 3 },
          reason: 'Im Team besprochen',
        },
      }),
    );
  });

  it('ohne Rolle in der Warengruppe ist die Seite lesbar, aber ohne Knöpfe', async () => {
    segmentation = { ...segmentation, canManage: false, raters: [] };
    renderAt(`/warengruppen/${group}/segmentierung`);
    expect(
      await screen.findByText(
        'Runde starten und Segmente festlegen dürfen Lead, Commodity Manager und Admin.',
      ),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Segment festlegen/ })).toBeNull();
  });
});

describe('WG-18 Portfolio mit Filter Warengruppe', () => {
  const point = (n: number, ist: [number, number], soll: [number, number], spendCents: number) => ({
    relationshipId: uuid(n),
    name: `Lieferant ${n}`,
    spendCents,
    currency: 'EUR',
    businessUnit: null,
    materialGroup: { id: group, name: 'Leiterplatten' },
    ist: typed(ist[0], ist[1], ist[0] === 3 ? 'Strategisch' : 'Entwickeln'),
    soll: typed(soll[0], soll[1], soll[0] === 3 ? 'Strategisch' : 'Entwickeln'),
  });
  const matrix: PortfolioMatrix = {
    spendYear: 2025,
    businessUnits: [],
    materialGroups: [{ id: group, name: 'Leiterplatten' }],
    points: [point(1, [2, 2], [3, 3], 3_000_000), point(2, [3, 3], [3, 3], 1_000_000)],
  };

  it('Titel nennt den Filter; Umschalter Ist, Soll, beides; Spend nach Segment', async () => {
    api.handle = ({ url }) =>
      url.startsWith('/api/portfolio/matrix') ? Response.json(matrix) : undefined;
    renderAt(`/portfolio/matrix?wg=${group}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Matrix · Leiterplatten' }),
    ).toBeTruthy();
    const view = screen.getByRole('group', { name: 'Ansicht' });
    expect((within(view).getByRole('radio', { name: 'Beides' }) as HTMLInputElement).checked).toBe(
      true,
    );
    const spend = screen.getByRole('region', { name: 'Spend nach Segment' });
    expect(within(spend).getByText('Spend 2025 in Leiterplatten, nach Segment Ist.')).toBeTruthy();
    expect(within(spend).getByText('75 %')).toBeTruthy();
    // Soll: alle im Segment Strategisch
    fireEvent.click(within(view).getByRole('radio', { name: 'Soll' }));
    expect(await within(spend).findByText('100 %')).toBeTruthy();
  });

  it('Spend nach Segment rechnet je nach Ansicht mit Ist oder Soll', () => {
    expect(spendBySegment(matrix.points, 'ist').map((entry) => [entry.name, entry.share])).toEqual([
      ['Entwickeln', 0.75],
      ['Strategisch', 0.25],
    ]);
    expect(spendBySegment(matrix.points, 'soll').map((entry) => [entry.name, entry.share])).toEqual(
      [['Strategisch', 1]],
    );
  });

  it('„Zu klären“ zeigt Lieferanten mit jüngerer Entscheidung in einer Warengruppe', async () => {
    api.handle = ({ url }) =>
      url === '/api/portfolio/open'
        ? Response.json({
            deviationThreshold: 30,
            groups: {
              ratings_open: [],
              not_consolidated: [],
              deviation: [],
              category_newer: [
                {
                  relationshipId: uuid(1),
                  name: 'Rheintal Elektronik',
                  submitted: 0,
                  total: 0,
                  deviation: null,
                  materialGroup: { id: group, name: 'Leiterplatten' },
                },
              ],
            },
          })
        : undefined;
    renderAt('/portfolio/offen');
    expect(
      await screen.findByRole('heading', { name: 'Gesamtentscheidung älter (1)' }),
    ).toBeTruthy();
    expect(screen.getByText('Jünger entschieden in Leiterplatten')).toBeTruthy();
  });
});

describe('WG-18 Lieferantenliste', () => {
  it('zeigt das Gesamtsegment; mit Filter Warengruppe das Segment dort mit ihrem Namen', async () => {
    const base = sampleSuppliers.suppliers[0] as SuppliersResponse['suppliers'][number];
    const body: SuppliersResponse = {
      ...sampleSuppliers,
      suppliers: [
        {
          ...base,
          name: 'Rheintal Elektronik',
          materialGroupIds: [group],
          segmentType: '1-1',
          categorySegments: [{ materialGroupId: group, type: '3-3' }],
        },
      ],
      count: 1,
      filters: {
        businessUnits: [],
        materialGroups: [{ id: group, name: 'Leiterplatten', parentId: null }],
        targetTypes: [
          { key: '3-3', name: 'Strategisch' },
          { key: '1-1', name: 'Routine' },
        ],
      },
    };
    api.suppliers = { status: 200, body };
    renderAt('/lieferanten');
    expect(await screen.findByText('Segment Routine')).toBeTruthy();
    tearDownApp();
    setUpApp();
    api.suppliers = { status: 200, body };
    renderAt(`/lieferanten?wg=${group}`);
    expect(await screen.findByText('In Leiterplatten: Strategisch')).toBeTruthy();
    expect(screen.queryByText('Segment Routine')).toBeNull();
  });
});
