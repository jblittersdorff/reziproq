// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  actionsFor,
  anna,
  api,
  renderAt,
  sampleOrganization,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';

// Oberflächentests zu docs/specs/PLT-05.md, Teil a: Mitglieder mit Rolle, Rolle ändern.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const anna_ = sampleOrganization.members[0];
let requests: { method: string; url: string; body: unknown }[] = [];
let lastAdmin = false;

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  api.me = { ...anna, orgRole: 'admin' };
  api.permissions = actionsFor.admin;
  requests = [];
  lastAdmin = false;
  api.handle = (request) => {
    requests.push(request);
    if (request.url === '/api/organisation/mitglieder/anna') {
      if (request.method === 'PUT') {
        return lastAdmin
          ? Response.json({ code: 'letzter_admin' }, { status: 409 })
          : Response.json({ ...anna_, ...(request.body as object) });
      }
      return Response.json(anna_);
    }
    if (request.url.startsWith('/api/audit')) return Response.json({ entries: [] });
    return undefined;
  };
});

afterEach(tearDownApp);

describe('Einstellungen › Organisation mit Rollen', () => {
  it('Admins öffnen über den Namen die Seite des Mitglieds, ändern die Rolle und kommen zur Liste zurück', async () => {
    const router = renderAt('/einstellungen/organisation');
    fireEvent.click(await screen.findByRole('link', { name: 'Anna Schmidt bearbeiten' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Anna Schmidt' })).toBeDefined();
    expect(router.state.location.pathname).toBe('/einstellungen/organisation/anna');

    fireEvent.click(screen.getByRole('radio', { name: 'Admin' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Controlling' }));
    fireEvent.change(screen.getByLabelText('Standardfunktion', { exact: false }), {
      target: { value: 'logistics' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/einstellungen/organisation'));
    expect(requests.find((r) => r.method === 'PUT')?.body).toEqual({
      orgRole: 'admin',
      isControlling: true,
      defaultFunction: 'logistics',
    });
    expect(await screen.findByText('Gespeichert.')).toBeDefined();
  });

  it('Der letzte Admin einer Organisation kann sich nicht selbst herabstufen: die Seite sagt warum', async () => {
    lastAdmin = true;
    renderAt('/einstellungen/organisation/anna');
    await screen.findByRole('heading', { level: 1, name: 'Anna Schmidt' });
    fireEvent.click(screen.getByRole('radio', { name: 'Leser' }));
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Es muss mindestens einen Admin geben.',
    );
  });

  it('Nutzer ohne Recht sehen die Rollen, aber keine Links und keinen Speichern-Knopf', async () => {
    api.me = anna;
    api.permissions = actionsFor.member;
    renderAt('/einstellungen/organisation');
    const table = await screen.findByRole('table', { name: 'Mitglieder' });
    await within(table).findByText('Anna Schmidt');
    expect(within(table).queryAllByRole('link')).toEqual([]);
    expect(within(table).getByText('Admin')).toBeDefined();

    tearDownApp();
    setUpApp();
    api.permissions = actionsFor.member;
    api.handle = (request) =>
      request.url === '/api/organisation/mitglieder/anna'
        ? Response.json(anna_)
        : request.url.startsWith('/api/audit')
          ? Response.json({ entries: [] })
          : undefined;
    renderAt('/einstellungen/organisation/anna');
    await screen.findByRole('heading', { level: 1, name: 'Anna Schmidt' });
    expect(screen.queryByRole('button', { name: 'Speichern' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Admin' }).matches(':disabled')).toBe(true);
  });
});
