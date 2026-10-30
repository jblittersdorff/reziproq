// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/theme';
import { routeTree } from '@/routeTree.gen';

// Nachgebauter Login: react-oidc-context liefert den Zustand, den der Test vorgibt.
const auth = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

const signedIn = {
  isLoading: false,
  error: undefined,
  user: { access_token: 'access-token-1', expired: false },
  signinRedirect: vi.fn(),
  signoutRedirect: vi.fn(),
};

// Nachgebaute API: /api/me nur mit dem Token aus dem Login.
function fakeApi(input: RequestInfo | URL, init?: RequestInit) {
  const url = String(input);
  const authorization = new Headers(init?.headers).get('authorization');
  if (url === '/api/health') return Response.json({ status: 'ok' });
  if (url === '/api/me' && authorization === 'Bearer access-token-1') {
    return Response.json({ name: 'Ada Lovelace', email: 'ada@example.com' });
  }
  return Response.json({ statusCode: 401 }, { status: 401 });
}

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  });
  render(
    <ThemeProvider>
      <LocaleProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </LocaleProvider>
    </ThemeProvider>,
  );
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  auth.state = signedIn;
  localStorage.setItem('reziproq-locale', 'de');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input, init) => fakeApi(input, init)),
  );
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  consoleError = vi.spyOn(console, 'error');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  // Jede Seite rendert ohne Fehler, auch ohne Fehlermeldungen von React in der Konsole.
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

const pages = [
  { path: '/', title: 'Übersicht', nav: 'Übersicht', release: '0.1' },
  { path: '/lieferanten', title: 'Lieferanten', nav: 'Lieferanten', release: '0.1' },
  { path: '/beziehungen', title: 'Beziehungen', nav: 'Beziehungen', release: '0.2' },
  { path: '/beziehungspuls', title: 'Beziehungspuls', nav: 'Beziehungspuls', release: '0.2' },
  {
    path: '/joint-business-plans',
    title: 'Joint Business Plans',
    nav: 'Joint Business Plans',
    release: '0.3',
  },
  { path: '/qbrs', title: 'QBRs und Maßnahmen', nav: 'QBRs und Maßnahmen', release: '0.3' },
  { path: '/pnl-impact', title: 'P&L-Impact', nav: 'P&L-Impact', release: '1.0' },
  { path: '/einstellungen', title: 'Einstellungen', nav: 'Einstellungen', release: undefined },
];

describe('App-Rahmen mit Login', () => {
  it.each(pages)('$path rendert und ist in der Navigation markiert', async (page) => {
    renderAt(page.path);

    expect(await screen.findByRole('heading', { level: 1, name: page.title })).toBeDefined();
    if (page.release) {
      expect(screen.getByText(`Kommt mit Release ${page.release}`)).toBeDefined();
    }

    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(pages.map((p) => p.nav));
    const active = links.filter((link) => link.getAttribute('aria-current') === 'page');
    expect(active.map((link) => link.textContent)).toEqual([page.nav]);
  });

  it('zeigt Name und E-Mail aus /api/me im Nutzer-Menü', async () => {
    renderAt('/');
    expect(await screen.findByText('Ada Lovelace')).toBeDefined();
    expect(screen.getByText('ada@example.com')).toBeDefined();
  });

  it('zeigt auf den Einstellungen Konto und API-Status', async () => {
    renderAt('/einstellungen');
    expect(await screen.findByText('API: ok')).toBeDefined();
    expect(screen.getByRole('radio', { name: 'System' })).toHaveProperty('checked', true);
    expect(screen.getByRole('radio', { name: 'Deutsch' })).toHaveProperty('checked', true);
  });
});

describe('App-Rahmen ohne Login', () => {
  it.each(pages)('$path zeigt die Anmeldung statt der Seite', async (page) => {
    auth.state = { ...signedIn, user: null };
    renderAt(page.path);

    expect(await screen.findByRole('button', { name: 'Anmelden' })).toBeDefined();
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('heading', { name: page.title })).toBeNull();
    expect(fetch).not.toHaveBeenCalledWith('/api/me', expect.anything());
  });

  it('zeigt einen Ladezustand, solange die Sitzung geprüft wird', async () => {
    auth.state = { ...signedIn, user: null, isLoading: true };
    renderAt('/');
    expect((await screen.findByRole('status')).textContent).toBe('Anmeldung wird geprüft …');
  });
});
