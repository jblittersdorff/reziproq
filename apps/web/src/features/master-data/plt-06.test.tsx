// @vitest-environment jsdom
import type {
  AssignmentResponse,
  BusinessUnit,
  MaterialGroup,
  SupplierDetail,
} from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Oberflächentests zu docs/specs/PLT-06.md: Business Units, Warengruppen, Zuordnung.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const uuid = (n: number) => `0190a0a0-0000-7000-8000-${String(n).padStart(12, '0')}`;
const id = uuid(1);
const detail: SupplierDetail = {
  relationshipId: id,
  name: 'Rheintal Elektronik GmbH (Demo)',
  organizationName: 'Rheintal Elektronik GmbH (Demo)',
  country: 'DE',
  vatId: null,
  duns: null,
  externalRef: 'L-10001',
  notes: null,
  status: 'active',
  createdAt: '2026-10-01T08:00:00Z',
  endedAt: null,
  spend: [],
  permissions: { edit: true, editTeam: true },
};

const unit = (n: number, name: string, code: string, extra: Partial<BusinessUnit> = {}) => ({
  id: uuid(n),
  name,
  code,
  active: true,
  supplierCount: 0,
  ...extra,
});
const group = (
  n: number,
  name: string,
  code: string,
  extra: Partial<MaterialGroup> = {},
): MaterialGroup => ({
  ...unit(n, name, code),
  parentId: null,
  childCount: 0,
  description: null,
  leadUserId: null,
  commodityManagerUserId: null,
  ...extra,
});

let units: BusinessUnit[];
let groups: MaterialGroup[];
let assignment: AssignmentResponse;
let requests: { method: string; url: string; body: unknown }[];
/** Antwort der API auf Schreibzugriffe, falls ein Test einen Fehler braucht */
let writeReply: Response | undefined;

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  requests = [];
  writeReply = undefined;
  units = [
    unit(101, 'Pkw', 'PKW', { supplierCount: 3 }),
    unit(102, 'Nutzfahrzeuge', 'NFZ'),
    unit(103, 'Ersatzteile', 'ET', { active: false, supplierCount: 1 }),
    unit(104, 'Altbestand', 'ALT', { active: false }),
  ];
  groups = [
    group(201, 'Elektronik', 'EL', { childCount: 1, supplierCount: 2 }),
    group(202, 'Sensorik', 'EL-SE', { parentId: uuid(201), supplierCount: 1 }),
    group(203, 'Guss', 'GU'),
  ];
  assignment = {
    businessUnits: [
      { id: uuid(101), name: 'Pkw', code: 'PKW', active: true },
      { id: uuid(103), name: 'Ersatzteile', code: 'ET', active: false },
    ],
    materialGroups: [
      { id: uuid(202), name: 'Sensorik', code: 'EL-SE', active: true, isPrimary: true },
    ],
    canEdit: true,
  };
  api.handle = (request) => {
    requests.push(request);
    if (request.method !== 'GET' && writeReply) return writeReply;
    if (request.url === '/api/business-units' && request.method === 'GET') {
      return Response.json({ businessUnits: units });
    }
    if (request.url === '/api/material-groups' && request.method === 'GET') {
      return Response.json({ materialGroups: groups });
    }
    if (/^\/api\/(business-units|material-groups)/.test(request.url)) {
      if (request.method === 'DELETE') return new Response(null, { status: 204 });
      return Response.json({ id: uuid(999) });
    }
    if (request.url === `/api/suppliers/${id}`) return Response.json(detail);
    if (request.url === `/api/suppliers/${id}/zuordnung`) return Response.json(assignment);
    if (request.url.startsWith('/api/audit')) return Response.json({ entries: [] });
    return undefined;
  };
});

afterEach(tearDownApp);

const writes = () => requests.filter((request) => request.method !== 'GET');

describe('Business Units und Warengruppen', () => {
  it('Alle Formulare sind eigene Seiten. Speichern und Abbrechen führen zurück.', async () => {
    const router = renderAt('/einstellungen/business-units');
    fireEvent.click(await screen.findByRole('link', { name: 'Neue Business Unit' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/einstellungen/business-units/neu'),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/einstellungen/business-units'),
    );

    fireEvent.click(await screen.findByRole('link', { name: 'Neue Business Unit' }));
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Busse' } });
    fireEvent.change(screen.getByLabelText('Code', { exact: false }), { target: { value: 'BUS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/einstellungen/business-units'),
    );
    expect(writes()).toEqual([
      { method: 'POST', url: '/api/business-units', body: { name: 'Busse', code: 'BUS' } },
    ]);
    expect(await screen.findByText('Gespeichert.')).toBeDefined();

    // Bearbeiten auf eigener Seite; Speichern führt zurück.
    fireEvent.click(screen.getByRole('link', { name: 'Nutzfahrzeuge bearbeiten' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        `/einstellungen/business-units/${uuid(102)}/bearbeiten`,
      ),
    );
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Lkw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/einstellungen/business-units'),
    );
    expect(writes().at(-1)).toEqual({
      method: 'PATCH',
      url: `/api/business-units/${uuid(102)}`,
      body: { name: 'Lkw', code: 'NFZ' },
    });
  });

  it('Ein Admin deaktiviert mit Bestätigung auf der Seite; Nutzer und Leser sehen nur', async () => {
    renderAt(`/einstellungen/business-units/${uuid(102)}/bearbeiten`);
    fireEvent.click(await screen.findByRole('button', { name: 'Deaktivieren' }));
    const question = screen.getByRole('group', { name: /Wirklich deaktivieren/ });
    fireEvent.click(within(question).getByRole('button', { name: 'Deaktivieren' }));
    await waitFor(() =>
      expect(writes()).toEqual([
        {
          method: 'PATCH',
          url: `/api/business-units/${uuid(102)}`,
          body: { name: 'Nutzfahrzeuge', code: 'NFZ', active: false },
        },
      ]),
    );

    for (const role of ['member', 'viewer'] as const) {
      tearDownApp();
      setUpApp();
      api.permissions = actionsFor[role];
      api.handle = (request) =>
        request.url === '/api/business-units' ? Response.json({ businessUnits: units }) : undefined;
      renderAt('/einstellungen/business-units');
      await screen.findByRole('table', { name: 'Business Units' });
      expect(screen.queryByRole('link', { name: /Neue Business Unit|bearbeiten/ })).toBeNull();
      expect(screen.getByText('Ändern kann ein Admin.')).toBeDefined();
    }
  });

  it('Ein benutzter Eintrag lässt sich nicht löschen; ein unbenutzter schon', async () => {
    renderAt(`/einstellungen/business-units/${uuid(101)}/bearbeiten`);
    expect(
      await screen.findByText('Bei 3 Lieferanten zugeordnet. Deaktivieren statt löschen.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Löschen' })).toBeNull();
    // Eine Oberebene mit Untergruppen gilt als benutzt.
    tearDownApp();
    setUpApp();
    api.permissions = actionsFor.admin;
    api.handle = (request) => {
      requests.push(request);
      if (request.url === '/api/material-groups' && request.method === 'GET') {
        return Response.json({ materialGroups: groups });
      }
      if (request.method === 'DELETE') return new Response(null, { status: 204 });
      return undefined;
    };
    renderAt(`/einstellungen/warengruppen/${uuid(201)}/bearbeiten`);
    expect(
      await screen.findAllByText('Hat Untergruppen. Deaktivieren statt löschen.'),
    ).not.toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Löschen' })).toBeNull();

    tearDownApp();
    setUpApp();
    api.permissions = actionsFor.admin;
    api.handle = (request) => {
      requests.push(request);
      if (request.url === '/api/material-groups' && request.method === 'GET') {
        return Response.json({ materialGroups: groups });
      }
      if (request.method === 'DELETE') return new Response(null, { status: 204 });
      return undefined;
    };
    const router = renderAt(`/einstellungen/warengruppen/${uuid(203)}/bearbeiten`);
    fireEvent.click(await screen.findByRole('button', { name: 'Löschen' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: /Wirklich löschen/ })).getByRole('button', {
        name: 'Löschen',
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/einstellungen/warengruppen'));
    expect(requests.find((request) => request.method === 'DELETE')?.url).toBe(
      `/api/material-groups/${uuid(203)}`,
    );
  });

  it('Codes sind je Organisation eindeutig. Mehr als zwei Ebenen werden abgelehnt.', async () => {
    writeReply = Response.json({ statusCode: 409, code: 'code_taken' }, { status: 409 });
    renderAt('/einstellungen/warengruppen/neu');
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Elektrik' } });
    fireEvent.change(screen.getByLabelText('Code', { exact: false }), { target: { value: 'el' } });
    // Als Oberebene stehen nur Gruppen der obersten Ebene zur Wahl; eine dritte Ebene geht nicht.
    const parent = screen.getByLabelText('Oberebene', { exact: false }) as HTMLSelectElement;
    expect([...parent.options].map((option) => option.textContent)).toEqual([
      'Keine, oberste Ebene',
      'Elektronik',
      'Guss',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(
      await screen.findByText('Diesen Code gibt es in deiner Organisation schon.'),
    ).toBeDefined();
    // Ungültiger Code wird schon auf der Seite abgelehnt.
    fireEvent.change(screen.getByLabelText('Code', { exact: false }), {
      target: { value: 'mit leer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(
      await screen.findByText('Nur Buchstaben, Ziffern, Punkt, Binde- und Unterstrich.'),
    ).toBeDefined();

    // Eine Gruppe mit Untergruppen bekommt keine Oberebene.
    tearDownApp();
    setUpApp();
    api.permissions = actionsFor.admin;
    api.handle = (request) =>
      request.url === '/api/material-groups'
        ? Response.json({ materialGroups: groups })
        : undefined;
    renderAt(`/einstellungen/warengruppen/${uuid(201)}/bearbeiten`);
    expect(
      ((await screen.findByLabelText('Oberebene', { exact: false })) as HTMLSelectElement).disabled,
    ).toBe(true);
  });

  it('Leerer Zustand: Erste Business Unit anlegen, mit Hinweis auf den Import', async () => {
    units = [];
    renderAt('/einstellungen/business-units');
    expect(await screen.findByText('Noch keine Business Units')).toBeDefined();
    expect(await screen.findByText(/per Import/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Erste Business Unit anlegen' })).toBeDefined();
  });
});

describe('Zuordnung eines Lieferanten', () => {
  it('Das Profil zeigt die Zuordnung; die Haupt-Warengruppe ist markiert, deaktivierte gekennzeichnet', async () => {
    renderAt(`/lieferanten/${id}/strategie/profil`);
    const section = (await screen.findByText('Zuordnung')).closest('fieldset') as HTMLElement;
    await waitFor(() => expect(section.textContent).toContain('Pkw'));
    expect(section.textContent).toContain('Ersatzteile · deaktiviert');
    expect(section.textContent).toContain('Haupt-Warengruppe: Sensorik');
  });

  it('Deaktivierte Einträge sind für neue Zuordnungen nicht wählbar. Bestehende bleiben sichtbar und markiert.', async () => {
    renderAt(`/lieferanten/${id}/strategie/profil/zuordnung`);
    const unitsGroup = await screen.findByRole('group', { name: 'Business Units' });
    const labels = within(unitsGroup)
      .getAllByRole('checkbox')
      .map((box) => box.parentElement?.textContent);
    // Altbestand ist deaktiviert und nicht zugeordnet: nicht wählbar.
    expect(labels).toEqual(['Pkw', 'Nutzfahrzeuge', 'Ersatzteile · deaktiviert']);
    expect(
      within(unitsGroup)
        .getByRole('checkbox', { name: 'Ersatzteile · deaktiviert' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    // Untergruppen mit ihrer Oberebene.
    const groupsGroup = screen.getByRole('group', { name: 'Warengruppen' });
    expect(
      within(groupsGroup).getByRole('checkbox', { name: 'Elektronik › Sensorik' }),
    ).toBeDefined();
  });

  it('Mehrere BUs und Warengruppen je Lieferant, genau eine Haupt-Warengruppe', async () => {
    const router = renderAt(`/lieferanten/${id}/strategie/profil/zuordnung`);
    const groupsGroup = await screen.findByRole('group', { name: 'Warengruppen' });
    fireEvent.click(within(groupsGroup).getByRole('checkbox', { name: 'Guss' }));
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Business Units' })).getByRole('checkbox', {
        name: 'Nutzfahrzeuge',
      }),
    );
    // Zwei Warengruppen: die Haupt-Warengruppe ist zu wählen; Sensorik bleibt vorgewählt.
    const primary = screen.getByLabelText('Haupt-Warengruppe') as HTMLSelectElement;
    expect(primary.value).toBe(uuid(202));
    fireEvent.change(primary, { target: { value: uuid(203) } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/lieferanten/${id}/strategie/profil`),
    );
    expect(writes()).toEqual([
      {
        method: 'PUT',
        url: `/api/suppliers/${id}/zuordnung`,
        body: {
          businessUnitIds: [uuid(101), uuid(103), uuid(102)],
          materialGroupIds: [uuid(202), uuid(203)],
          primaryMaterialGroupId: uuid(203),
        },
      },
    ]);
  });

  it('Ohne Haupt-Warengruppe wird nicht gespeichert', async () => {
    renderAt(`/lieferanten/${id}/strategie/profil/zuordnung`);
    const groupsGroup = await screen.findByRole('group', { name: 'Warengruppen' });
    fireEvent.click(within(groupsGroup).getByRole('checkbox', { name: 'Guss' }));
    fireEvent.change(screen.getByLabelText('Haupt-Warengruppe'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Wähle genau eine Haupt-Warengruppe.',
    );
    expect(writes()).toEqual([]);
  });

  it('Die Lieferantenkarten zeigen die Haupt-Warengruppe. Die Suche findet auch Warengruppen.', async () => {
    renderAt('/lieferanten?suche=kabel');
    const list = await screen.findByRole('list', { name: 'Lieferanten' });
    const cards = within(list).getAllByRole('listitem');
    expect(cards).toHaveLength(1);
    expect(cards[0]?.textContent).toContain('Rheintal Elektronik GmbH (Demo)');
    expect(cards[0]?.textContent).toContain('Haupt-WarengruppeElektronik');
  });
});
