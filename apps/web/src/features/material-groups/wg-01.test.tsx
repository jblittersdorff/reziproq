// @vitest-environment jsdom
import type { MaterialGroupDetail, MaterialGroupOverview } from '@reziproq/shared';
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

// Tests zu docs/specs/WG-01.md in der Oberfläche: eigene Bezeichnung in Navigation und Titeln,
// leerer Zustand mit zwei Wegen, Baum mit Lead und Zahlen, Team und Produktgruppen für den Lead,
// Import nur ohne Fehler.

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
const label = { singular: 'Warengruppe', plural: 'Warengruppen' };
const group = (n: number, name: string, code: string, parentId: string | null = null) => ({
  id: uuid(n),
  name,
  code,
  parentId,
  active: true,
  lead: n === 10 ? { userId: 'anna', name: 'Anna Schmidt' } : null,
  productGroupCount: n === 10 ? 2 : 0,
  memberCount: n === 10 ? 3 : 0,
  supplierCount: n === 10 ? 4 : 1,
});
let overview: MaterialGroupOverview;
let detail: MaterialGroupDetail;
let sent: { method: string; url: string; body: unknown }[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  sent = [];
  api.me = { ...anna, orgRole: 'admin' };
  api.permissions = actionsFor.admin;
  overview = {
    label,
    canManage: true,
    unassignedSpendRows: 2,
    groups: [group(10, 'Elektronik', 'EL'), group(11, 'Sensorik', 'EL-SE', uuid(10))],
  };
  detail = {
    label,
    group: {
      id: uuid(10),
      name: 'Elektronik',
      code: 'EL',
      description: 'Elektronische Bauteile',
      active: true,
      lead: { userId: 'anna', name: 'Anna Schmidt' },
      commodityManager: null,
    },
    parent: null,
    children: [{ id: uuid(11), name: 'Sensorik', code: 'EL-SE', active: true }],
    productGroups: [{ id: uuid(20), name: 'Leiterplatten', description: null, position: 1 }],
    members: [
      {
        id: uuid(30),
        userId: 'anna',
        name: 'Anna Schmidt',
        role: 'lead',
        businessUnit: null,
        region: null,
        task: null,
      },
    ],
    suppliers: [
      {
        relationshipId: uuid(40),
        name: 'Rheintal Elektronik GmbH',
        source: 'spend',
        isPrimary: true,
      },
    ],
    canEdit: true,
    people: [
      { userId: 'anna', name: 'Anna Schmidt' },
      { userId: 'ben', name: 'Ben Berg' },
    ],
    businessUnits: [{ id: uuid(50), name: 'Antrieb' }],
  };
  api.handle = (request) => {
    if (request.url === '/api/warengruppen') return Response.json(overview);
    // WG-04: Die Übersicht zeigt die Strategien je Warengruppe.
    if (request.url === '/api/warengruppen/strategien') {
      return Response.json({
        year: 2027,
        next: null,
        approvedCount: 0,
        groups: overview.groups
          .filter((entry) => entry.parentId === null)
          .map((entry) => ({
            id: entry.id,
            name: entry.name,
            code: entry.code,
            lead: entry.lead,
            spend: null,
            supplierCount: entry.supplierCount,
            strategy: null,
            hidden: false,
            canCreate: false,
          })),
      });
    }
    if (request.url === `/api/warengruppen/${uuid(10)}`) return Response.json(detail);
    if (request.url.startsWith(`/api/warengruppen/${uuid(10)}/`)) {
      sent.push(request);
      if (request.url.endsWith('/team')) {
        detail = {
          ...detail,
          members: [
            ...detail.members,
            {
              id: uuid(31),
              userId: 'ben',
              name: 'Ben Berg',
              role: 'buyer',
              businessUnit: { id: uuid(50), name: 'Antrieb' },
              region: null,
              task: null,
            },
          ],
        };
      }
      if (request.url.endsWith('/produktgruppen')) {
        detail = {
          ...detail,
          productGroups: [
            ...detail.productGroups,
            { id: uuid(21), name: 'Steuergeräte', description: null, position: 2 },
          ],
        };
      }
      return Response.json(detail);
    }
    return undefined;
  };
});

afterEach(tearDownApp);

describe('WG-01 Warengruppen in der Oberfläche', () => {
  it('Kunde A mit „Werkstoffgruppe“ sieht das Wort in Navigation und Titeln, Kunde B „Warengruppe“', async () => {
    api.me = {
      ...anna,
      orgRole: 'admin',
      categoryLabel: { singular: 'Werkstoffgruppe', plural: 'Werkstoffgruppen' },
    };
    overview = { ...overview, label: { singular: 'Werkstoffgruppe', plural: 'Werkstoffgruppen' } };
    renderAt('/warengruppen');
    expect(await screen.findByRole('heading', { level: 1, name: 'Werkstoffgruppen' })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    await waitFor(() =>
      expect(within(nav).getByRole('link', { name: 'Werkstoffgruppen' })).toBeTruthy(),
    );
    expect(within(nav).queryByRole('link', { name: 'Warengruppen' })).toBeNull();
    tearDownApp();

    setUpApp();
    api.me = { ...anna, orgRole: 'admin' };
    api.permissions = actionsFor.admin;
    api.handle = (request) =>
      request.url === '/api/warengruppen' ? Response.json({ ...overview, label }) : undefined;
    renderAt('/warengruppen');
    expect(await screen.findByRole('heading', { level: 1, name: 'Warengruppen' })).toBeTruthy();
  });

  it('ohne Warengruppen zeigt die Seite zwei Wege: anlegen oder importieren', async () => {
    overview = { ...overview, groups: [], unassignedSpendRows: 0 };
    renderAt('/warengruppen');
    expect(await screen.findByText('Noch keine Warengruppen')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Warengruppe anlegen' }).getAttribute('href')).toBe(
      '/einstellungen/warengruppen/neu',
    );
    expect(screen.getByRole('link', { name: 'Importieren' }).getAttribute('href')).toBe(
      '/einstellungen/warengruppen/import',
    );
  });

  it('der Lead pflegt Team und Produktgruppen', async () => {
    renderAt(`/warengruppen/${uuid(10)}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Elektronik' })).toBeTruthy();
    const suppliers = screen.getByRole('region', { name: 'Lieferanten' });
    expect(within(suppliers).getByText('aus Spend')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Team bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: 'Person hinzufügen' }));
    fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'ben' } });
    fireEvent.change(screen.getByLabelText('Business Unit'), { target: { value: uuid(50) } });
    fireEvent.click(screen.getByRole('button', { name: 'Team speichern' }));
    await waitFor(() =>
      expect(sent.at(-1)).toMatchObject({
        method: 'PUT',
        body: { members: [{ userId: 'ben', role: 'buyer', businessUnitId: uuid(50) }] },
      }),
    );
    const team = await screen.findByRole('region', { name: 'Team' });
    expect(within(team).getByText('Ben Berg')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Produktgruppe anlegen'), {
      target: { value: 'Steuergeräte' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    expect(await screen.findByText('Steuergeräte')).toBeTruthy();
  });

  it('ohne Recht sieht man Team und Produktgruppen, aber keine Knöpfe', async () => {
    detail = { ...detail, canEdit: false };
    api.permissions = actionsFor.viewer;
    renderAt(`/warengruppen/${uuid(10)}`);
    expect(await screen.findByText('Leiterplatten')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Team bearbeiten' })).toBeNull();
    expect(screen.queryByLabelText('Produktgruppe anlegen')).toBeNull();
  });
});
