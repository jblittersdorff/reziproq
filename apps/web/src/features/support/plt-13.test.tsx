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
  orgRole: null,
  isOperator: true,
  permissions: { ...anna.permissions, viewSuppliers: false, switchCustomer: true },
};
const banner = (customer: string) =>
  `Betreiber-Ansicht: ${customer}. Alle Zugriffe werden protokolliert.`;

// Seit UMB-01 eine eigene Seite /betreiber/kunden statt eines Fensters.

describe('In einen Kunden wechseln', () => {
  it('fehlt auf dem Profil für Nutzer ohne is_operator, auch für Admins', async () => {
    api.me = { ...anna, orgRole: 'admin' };
    api.permissions = actionsFor.admin;
    renderAt('/profil');
    await screen.findByText('Anna Schmidt');
    expect(screen.queryByRole('link', { name: /In einen Kunden wechseln/ })).toBeNull();
    expect(api.requests.some((r) => r.url === '/api/betreiber/kunden')).toBe(false);
  });

  it('/betreiber/kunden ist über die Adresse erreichbar; ohne is_operator nur ein Hinweis', async () => {
    api.me = { ...anna, orgRole: 'admin' };
    renderAt('/betreiber/kunden');
    expect(
      await screen.findByText('Diese Seite ist nur für das Betreiber-Team von Reziproq.'),
    ).toBeDefined();
    expect(api.requests.some((r) => r.url === '/api/betreiber/kunden')).toBe(false);
  });

  it('Betreiber wählen auf eigener Seite einen Kunden und kommen zu Start, ohne Fenster', async () => {
    api.me = operator;
    const router = renderAt('/profil');
    await screen.findByText('Betreiber von Reziproq', { selector: 'span[data-slot="badge"]' });
    // Ohne Organisation ändert kein Admin die Rolle, also kein Hinweis darauf.
    expect(screen.queryByText(/Ändern kann sie ein Admin/)).toBeNull();
    fireEvent.click(await screen.findByRole('link', { name: /In einen Kunden wechseln/ }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/betreiber/kunden'));

    const list = await screen.findByRole('list', { name: 'In einen Kunden wechseln' });
    const choices = await within(list).findAllByRole('button');
    expect(choices.map((choice) => choice.textContent)).toEqual([
      'Beispiel-OEM (Demo)Deutschland',
      'Zweit-OEM (Demo)Österreich',
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();

    api.me = {
      ...operator,
      organization: { id: 'org-2', name: 'Zweit-OEM (Demo)' },
      supportView: true,
      orgRole: 'viewer',
    };
    fireEvent.click(within(list).getByRole('button', { name: 'In Zweit-OEM (Demo) wechseln' }));

    expect(await screen.findByText(banner('Zweit-OEM (Demo)'))).toBeDefined();
    await waitFor(() => expect(router.state.location.pathname).toBe('/start'));
    await waitFor(() =>
      expect(api.requests.filter((r) => r.url === '/api/me').at(-1)?.customer).toBe('org-2'),
    );
    expect(sessionStorage.getItem('reziproq-support-org')).toContain('org-2');
  });

  it('weist Betreiber ohne eigene Organisation auf „In einen Kunden wechseln“ hin', async () => {
    api.me = operator;
    renderAt('/start');
    expect(
      await screen.findByText(
        'Du bist keiner Organisation zugeordnet. Wähle als Betreiber auf deinem Profil „In einen Kunden wechseln“.',
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
      const customer = new Headers(init?.headers).get('x-reziproq-support-org');
      if (String(input) === '/api/me' && customer) {
        return Response.json({ statusCode: 403 }, { status: 403 });
      }
      return original ? original(input, init) : Response.json({});
    });
    renderAt('/start');
    await waitFor(() => expect(sessionStorage.getItem('reziproq-support-org')).toBeNull());
    expect(screen.queryByText(banner('Zweit-OEM (Demo)'))).toBeNull();
  });
});
