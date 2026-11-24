// @vitest-environment jsdom
import { defaultSroDescription, type RoleDescription, type TeamResponse } from '@reziproq/shared';
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

// Tests zu docs/specs/PLB-04.md in der Oberfläche: zwei Spalten mit Kennzeichen Intern oder
// Geteilt, Rollenbeschreibung des SRO auf eigener Seite, gespiegelte Seite beim Lieferanten mit
// Key Account Manager, Sichtbarkeit beim Bearbeiten, Einstellungen › Rollen.

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const rel = '0190a0a0-0000-7000-8000-00000000000c';
const sro: RoleDescription = { role: 'sro', ...defaultSroDescription, updatedByName: null };
const buyerTeam: TeamResponse = {
  side: 'buyer',
  members: [
    {
      userId: 'lena',
      name: 'Lena Berger',
      teamRole: 'sro',
      function: 'purchasing',
      visibility: 'shared',
    },
    {
      userId: 'tom',
      name: 'Tom Krüger',
      teamRole: 'member',
      function: 'quality',
      visibility: 'internal',
    },
  ],
  counterpart: [{ name: 'Kim Kaiser', teamRole: 'sro', function: null }],
  candidates: [],
  canEdit: true,
  sroDescription: sro,
};
const supplierTeam: TeamResponse = {
  side: 'supplier',
  members: [
    { userId: 'kim', name: 'Kim Kaiser', teamRole: 'sro', function: null, visibility: 'shared' },
  ],
  counterpart: [{ name: 'Lena Berger', teamRole: 'sro', function: 'purchasing' }],
  candidates: [{ userId: 'ole', name: 'Ole Brandt', defaultFunction: null }],
  canEdit: true,
  sroDescription: null,
};
const supplierDetail = {
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
let roles: RoleDescription[];

const asSupplier = () => {
  api.me = {
    ...anna,
    name: 'Kim Kaiser',
    firstName: 'Kim',
    organization: { id: 'org-lieferant', name: 'Rheintal Elektronik (Demo)' },
    orgRole: 'admin',
    permissions: {
      viewOrganizationSettings: true,
      viewBuyerAreas: false,
      viewSuppliers: false,
      viewCustomers: true,
      switchCustomer: false,
    },
  };
  api.permissions = ['organisation.sehen', 'start.sehen', 'kunden.sehen', 'team.festlegen'];
};

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  sent = [];
  roles = [sro];
  api.handle = (request) => {
    if (request.method !== 'GET') sent.push(request);
    if (request.url === `/api/suppliers/${rel}`) return Response.json(supplierDetail);
    if (request.url === `/api/suppliers/${rel}/team`) return Response.json(buyerTeam);
    if (request.url === '/api/kunden') {
      return Response.json({
        customers: [{ relationshipId: rel, name: 'OEM 1', nextMeeting: null }],
      });
    }
    if (request.url === `/api/kunden/${rel}`) {
      return Response.json({
        relationshipId: rel,
        name: 'OEM 1',
        relationshipType: null,
        nextMeeting: null,
      });
    }
    if (request.url === `/api/kunden/${rel}/team`) return Response.json(supplierTeam);
    if (request.url.startsWith('/api/rollen')) {
      if (request.method === 'PUT') {
        roles = [
          {
            role: 'sro',
            ...(request.body as Omit<RoleDescription, 'role' | 'updatedByName'>),
            updatedByName: 'Anna Schmidt',
          },
        ];
      }
      return Response.json(roles);
    }
    if (request.url.startsWith('/api/audit')) return Response.json({ entries: [] });
    return undefined;
  };
});

afterEach(tearDownApp);

const rows = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .map((row) => row.textContent);

describe('PLB-04 Team beider Seiten in der Oberfläche', () => {
  it('zeigt unser Team mit Intern oder Geteilt und die geteilten Mitglieder des Lieferanten', async () => {
    renderAt(`/lieferanten/${rel}/beziehung/team`);
    expect(rows(await screen.findByRole('table', { name: 'Unser Team' }))).toEqual([
      'PersonTeamrolleFunktion',
      'Lena BergerGeteiltSROEinkauf',
      'Tom KrügerInternMitgliedQualität',
    ]);
    // Beim Lieferanten heißt die Rolle Key Account Manager; die andere Seite zeigt nur Geteilte.
    expect(rows(screen.getByRole('table', { name: 'Team des Lieferanten' }))).toEqual([
      'PersonTeamrolleFunktion',
      'Kim KaiserKey Account Manager–',
    ]);
  });

  it('ein Klick auf „SRO“ öffnet die Rollenbeschreibung auf eigener Seite', async () => {
    const router = renderAt(`/lieferanten/${rel}/beziehung/team`);
    fireEvent.click(await screen.findByRole('link', { name: 'SRO: Was macht der SRO?' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/lieferanten/${rel}/beziehung/team/sro`),
    );
    const does = (await screen.findByRole('heading', { name: 'Macht' }))
      .parentElement as HTMLElement;
    expect(
      within(does)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(defaultSroDescription.does);
    expect(screen.getByText(/Standard von Reziproq/)).toBeDefined();
  });

  it('der Lieferant sieht die gespiegelte Seite und pflegt dort sein Team mit Sichtbarkeit', async () => {
    asSupplier();
    const router = renderAt(`/kunden/${rel}/beziehung/team`);
    expect(rows(await screen.findByRole('table', { name: 'Unser Team' }))).toEqual([
      'PersonTeamrolleFunktion',
      'Kim KaiserGeteiltKey Account Manager–',
    ]);
    expect(rows(screen.getByRole('table', { name: 'Team des Kunden' }))).toEqual([
      'PersonTeamrolleFunktion',
      'Lena BergerSROEinkauf',
    ]);
    fireEvent.click(screen.getByRole('link', { name: 'Team bearbeiten' }));
    await screen.findByRole('list', { name: 'Team' });
    fireEvent.change(screen.getByLabelText('Person hinzufügen', { exact: false }), {
      target: { value: 'ole' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    expect(screen.getByRole('combobox', { name: 'Sichtbarkeit: Ole Brandt' })).toHaveProperty(
      'value',
      'internal',
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Sichtbarkeit: Ole Brandt' }), {
      target: { value: 'shared' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/kunden/${rel}/beziehung/team`),
    );
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      url: `/api/kunden/${rel}/team`,
      body: {
        members: [
          { userId: 'kim', teamRole: 'sro', function: null, visibility: 'shared' },
          { userId: 'ole', teamRole: 'member', function: null, visibility: 'shared' },
        ],
      },
    });
  });

  it('Einstellungen › Rollen speichert, was der SRO macht und was nicht', async () => {
    renderAt('/einstellungen');
    fireEvent.click(await screen.findByRole('link', { name: /Rollen/ }));
    const field = (await screen.findByLabelText('Macht nicht', {
      exact: false,
    })) as HTMLTextAreaElement;
    expect(field.value).toBe('Verhandlungen\nEngpässe\nClaims');
    fireEvent.change(field, { target: { value: 'Verhandlungen\n\n  Claims ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(sent[0]).toMatchObject({
        method: 'PUT',
        url: '/api/rollen/sro',
        body: { does: defaultSroDescription.does, doesNot: ['Verhandlungen', 'Claims'] },
      }),
    );
    expect(await screen.findByText('Angepasst von Anna Schmidt.')).toBeDefined();
  });
});
