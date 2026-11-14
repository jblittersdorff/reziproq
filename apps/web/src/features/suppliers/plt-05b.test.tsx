// @vitest-environment jsdom
import type { SupplierDetail, TeamResponse } from '@reziproq/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actionsFor, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Oberflächentests zu docs/specs/PLT-05.md, Teil b: Team je Beziehung, Teamrolle Leser.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const id = '0190a0a0-0000-7000-8000-000000000001';
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
const team: TeamResponse = {
  side: 'buyer',
  counterpart: [],
  canEdit: true,
  sroDescription: null,
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
      teamRole: 'sponsor',
      function: 'quality',
      visibility: 'shared',
    },
  ],
  candidates: [
    { userId: 'lena', name: 'Lena Berger', defaultFunction: 'purchasing' },
    { userId: 'nina', name: 'Nina Roth', defaultFunction: 'logistics' },
    { userId: 'tom', name: 'Tom Krüger', defaultFunction: 'quality' },
  ],
};

let requests: { method: string; url: string; body: unknown }[] = [];
let currentDetail = detail;
let currentTeam = team;

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.permissions = actionsFor.admin;
  requests = [];
  currentDetail = detail;
  currentTeam = team;
  api.handle = (request) => {
    requests.push(request);
    if (request.url === `/api/suppliers/${id}`) return Response.json(currentDetail);
    if (request.url === `/api/suppliers/${id}/team`) {
      if (request.method === 'PUT') return Response.json(currentTeam);
      return Response.json(currentTeam);
    }
    if (request.url.startsWith('/api/audit')) return Response.json({ entries: [] });
    return undefined;
  };
});

afterEach(tearDownApp);

const teamPath = `/lieferanten/${id}/beziehung/team`;

describe('Team einer Beziehung', () => {
  it('zeigt das Team mit Teamrolle und Funktion; das Profil führt dorthin', async () => {
    const router = renderAt(`/lieferanten/${id}/strategie/profil`);
    fireEvent.click(await screen.findByRole('link', { name: 'Team' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(teamPath));
    const table = await screen.findByRole('table', { name: 'Unser Team' });
    expect(
      within(table)
        .getAllByRole('row')
        .map((row) => row.textContent),
    ).toEqual([
      'PersonTeamrolleFunktion',
      'Lena BergerGeteiltSROEinkauf',
      'Tom KrügerGeteiltSponsorQualität',
    ]);
    expect(screen.getByRole('link', { name: 'Team bearbeiten' })).toBeDefined();
  });

  it('weist auf ein Team ohne SRO hin und zeigt Bearbeiten nur mit Recht', async () => {
    currentTeam = { ...team, members: [team.members[1] as TeamResponse['members'][number]] };
    currentTeam = { ...currentTeam, canEdit: false };
    renderAt(teamPath);
    expect(await screen.findByText(/Noch kein SRO/)).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Team bearbeiten' })).toBeNull();
  });

  it('bearbeitet das Team auf eigener Seite: hinzufügen, Rolle ändern, entfernen, zurück', async () => {
    const router = renderAt(`${teamPath}/bearbeiten`);
    await screen.findByRole('list', { name: 'Team' });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.change(screen.getByLabelText('Person hinzufügen', { exact: false }), {
      target: { value: 'nina' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));
    // Die Funktion kommt aus der Standardfunktion der Person.
    expect(screen.getByRole('combobox', { name: 'Funktion: Nina Roth' })).toHaveProperty(
      'value',
      'logistics',
    );
    fireEvent.change(screen.getByRole('combobox', { name: 'Teamrolle: Nina Roth' }), {
      target: { value: 'viewer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tom Krüger entfernen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(teamPath));
    expect(requests.find((r) => r.method === 'PUT')?.body).toEqual({
      members: [
        { userId: 'lena', teamRole: 'sro', function: 'purchasing', visibility: 'shared' },
        { userId: 'nina', teamRole: 'viewer', function: 'logistics', visibility: 'internal' },
      ],
    });
    expect(await screen.findByText('Gespeichert.')).toBeDefined();
  });

  it('prüft die Grenzen schon auf der Seite: höchstens ein SRO', async () => {
    renderAt(`${teamPath}/bearbeiten`);
    await screen.findByRole('list', { name: 'Team' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Teamrolle: Tom Krüger' }), {
      target: { value: 'sro' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Ein Team hat höchstens einen SRO.',
    );
    expect(requests.some((r) => r.method === 'PUT')).toBe(false);
  });

  it('Mit Teamrolle Leser ist eine Beziehung für diesen Nutzer schreibgeschützt: keine Knöpfe, ein Hinweis', async () => {
    api.permissions = actionsFor.member;
    currentDetail = { ...detail, permissions: { edit: false, editTeam: false } };
    renderAt(`/lieferanten/${id}/strategie/profil`);
    expect(await screen.findByText(/schreibgeschützt \(Teamrolle Leser\)/)).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Bearbeiten' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Beziehung beenden' })).toBeNull();
  });
});
