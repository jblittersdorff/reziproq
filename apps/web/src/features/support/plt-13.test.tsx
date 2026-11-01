// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSupportCustomer } from '@/lib/support';
import {
  actionsFor,
  anna,
  api,
  renderAt,
  setUpApp,
  signedIn,
  tearDownApp,
} from '@/testing/app-harness';

// Oberflächentests zu docs/specs/PLT-13.md: Betreiber-Zugang zu Kunden.

const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
});

afterEach(tearDownApp);

const operator = {
  ...anna,
  organization: null,
  permissions: { ...anna.permissions, viewSuppliers: false, switchCustomer: true },
};
const banner = (customer: string) =>
  `Betreiber-Ansicht: ${customer}. Alle Zugriffe werden protokolliert.`;

// Seit PLT-11 steht „Kunde wechseln“ auf der Seite /profil; der Dialog bleibt bis UMB-01.

describe('Kunde wechseln', () => {
  it('fehlt auf dem Profil für Nutzer ohne Rolle betreiber, auch für Admins', async () => {
    api.me = { ...anna, orgRole: 'admin' };
    api.permissions = actionsFor.admin;
    renderAt('/profil');
    await screen.findByText('Anna Schmidt');
    expect(screen.queryByRole('button', { name: 'Kunde wechseln' })).toBeNull();
    expect(api.requests.some((r) => r.url === '/api/betreiber/kunden')).toBe(false);
  });

  it('zeigt Betreibern die Kunden und wechselt per Klick in einen davon', async () => {
    api.me = operator;
    const router = renderAt('/profil');
    fireEvent.click(await screen.findByRole('button', { name: 'Kunde wechseln' }));

    const dialog = await screen.findByRole('dialog', { name: 'In einen Kunden wechseln' });
    const choices = await within(dialog).findAllByRole('button');
    expect(choices.map((choice) => choice.textContent)).toEqual([
      'Beispiel-OEM (Demo)Deutschland',
      'Zweit-OEM (Demo)Österreich',
    ]);

    api.me = {
      ...operator,
      organization: { id: 'org-2', name: 'Zweit-OEM (Demo)' },
      supportView: true,
    };
    fireEvent.click(within(dialog).getByRole('button', { name: /Zweit-OEM/ }));

    expect(await screen.findByText(banner('Zweit-OEM (Demo)'))).toBeDefined();
    await waitFor(() => expect(router.state.location.pathname).toBe('/start'));
    await waitFor(() =>
      expect(api.requests.filter((r) => r.url === '/api/me').at(-1)?.customer).toBe('org-2'),
    );
  });

  it('weist Betreiber ohne eigene Organisation auf „Kunde wechseln“ hin', async () => {
    api.me = operator;
    renderAt('/start');
    expect(
      await screen.findByText(
        'Du bist keiner Organisation zugeordnet. Wähle als Betreiber auf deinem Profil „Kunde wechseln“.',
      ),
    ).toBeDefined();
  });
});

describe('Betreiber-Ansicht', () => {
  beforeEach(() => {
    api.me = {
      ...operator,
      organization: { id: 'org-2', name: 'Zweit-OEM (Demo)' },
      supportView: true,
    };
    setSupportCustomer({ id: 'org-2', name: 'Zweit-OEM (Demo)' });
  });

  it.each(['/start', '/lieferanten', '/portfolio', '/profil', '/einstellungen', '/gibt-es-nicht'])(
    'zeigt die Hinweisleiste auf %s und schickt den Kunden bei jeder Anfrage mit',
    async (path) => {
      renderAt(path);
      expect(await screen.findByText(banner('Zweit-OEM (Demo)'))).toBeDefined();
      const apiCalls = api.requests.filter((r) => r.url !== '/api/health');
      expect(apiCalls.length).toBeGreaterThan(0);
      expect(apiCalls.every((r) => r.customer === 'org-2')).toBe(true);
    },
  );

  it('„Verlassen“ beendet die Ansicht; danach geht kein Kunde mehr mit', async () => {
    api.me = { ...operator, supportView: false };
    renderAt('/lieferanten');
    fireEvent.click(await screen.findByRole('button', { name: 'Verlassen' }));
    await waitFor(() => expect(screen.queryByText(banner('Zweit-OEM (Demo)'))).toBeNull());
    // Nach dem Verlassen lädt die App /me neu, diesmal ohne Kunden.
    const before = api.requests.findLastIndex((r) => r.customer === 'org-2');
    await waitFor(() =>
      expect(api.requests.slice(before + 1).some((r) => r.url === '/api/me')).toBe(true),
    );
    expect(api.requests.slice(before + 1).every((r) => r.customer === null)).toBe(true);
  });

  it('endet von selbst, wenn die API den Kunden ablehnt', async () => {
    const fetchMock = vi.mocked(fetch);
    const original = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (input, init) => {
      const customer = new Headers(init?.headers).get('x-reziproq-kunde');
      if (String(input) === '/api/me' && customer) {
        return Response.json({ statusCode: 403 }, { status: 403 });
      }
      return original ? original(input, init) : Response.json({});
    });
    renderAt('/start');
    await waitFor(() => expect(sessionStorage.getItem('reziproq-betreiber-kunde')).toBeNull());
    expect(screen.queryByText(banner('Zweit-OEM (Demo)'))).toBeNull();
  });
});
