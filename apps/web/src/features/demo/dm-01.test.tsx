// @vitest-environment jsdom
import { businessTimeHeader, type DemoSession } from '@reziproq/shared';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appNow, businessTimeKey } from '@/lib/clock';
import { demoPersonToRestart, demoRestartHref, readDemoSession } from '@/lib/demo-session';
import { LocaleProvider } from '@/lib/i18n';
import { api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';
import { DemoSignInPage } from './demo-sign-in-page';

const auth = vi.hoisted(() => globalThis.reziproqTestAuth);
vi.mock('react-oidc-context', () => ({
  useAuth: () => auth.state,
  AuthProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

// DM-01, E-K0-05 (K1-b.2): /demo/als/<Person> startet eine Demo-Sitzung ohne Zitadel und speichert
// sie im Tab; ohne Demo-Person oder ohne Schalter sagt die Seite, warum es keine gibt.

const session: DemoSession = {
  accessToken: 'demo-token',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  person: {
    id: 'jan-luka',
    name: 'Jan-Luka',
    orgId: '550e8400-e29b-41d4-a716-446655440001',
    orgName: 'Hollmann Antriebe',
    orgRole: 'member',
    buyer: true,
  },
};
let requested: unknown[];

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
  requested = [];
  window.sessionStorage.clear();
  api.handle = (request) => {
    if (request.url === '/api/demo/sitzung' && request.method === 'POST') {
      requested.push(request.body);
      const userId = (request.body as { userId: string }).userId;
      return userId === 'jan-luka'
        ? Response.json(session, { headers: { [businessTimeHeader]: '2026-11-23T06:30:00.000Z' } })
        : Response.json({ statusCode: 404 }, { status: 404 });
    }
    return undefined;
  };
});

afterEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  tearDownApp();
});

describe('DM-01 Demo-Sitzung je Person', () => {
  it('startet die Sitzung für die Person und speichert sie in diesem Tab', async () => {
    renderAt('/demo/als/jan-luka');
    expect(await screen.findByText('Angemeldet als Jan-Luka · Hollmann Antriebe')).toBeTruthy();
    expect(requested).toEqual([{ userId: 'jan-luka' }]);
    expect(readDemoSession()?.accessToken).toBe('demo-token');
    // K1-b.5: Die Fachzeit des Mandanten gilt sofort und steht für das Neuladen im Tab
    expect(appNow().toISOString().slice(0, 10)).toBe('2026-11-23');
    expect(window.sessionStorage.getItem(businessTimeKey)).not.toBeNull();
  });

  it('ohne Demo-Person keine Sitzung, mit Grund', async () => {
    renderAt('/demo/als/unbekannt');
    expect(await screen.findByText('Keine Demo-Sitzung')).toBeTruthy();
    await waitFor(() => expect(readDemoSession()).toBeNull());
  });

  it('eine abgelaufene Sitzung gilt nicht mehr', () => {
    window.sessionStorage.setItem(
      'reziproq.demo-sitzung',
      JSON.stringify({ ...session, expiresAt: new Date(Date.now() - 1000).toISOString() }),
    );
    expect(readDemoSession()).toBeNull();
    expect(window.sessionStorage.getItem('reziproq.demo-sitzung')).toBeNull();
  });

  it('merkt sich die Person, auch über den Ablauf; ein gescheiterter Start vergisst sie', async () => {
    renderAt('/demo/als/jan-luka');
    await screen.findByText('Angemeldet als Jan-Luka · Hollmann Antriebe');
    expect(window.localStorage.getItem('reziproq.demo-person')).toBe('jan-luka');
    // Abgelaufen: die Person des Tabs bleibt für den Neustart
    window.sessionStorage.setItem(
      'reziproq.demo-sitzung',
      JSON.stringify({ ...session, expiresAt: new Date(Date.now() - 1000).toISOString() }),
    );
    expect(demoPersonToRestart()).toBe('jan-luka');
    // Neuer Tab: die zuletzt im Browser genutzte Person
    window.sessionStorage.clear();
    expect(demoPersonToRestart()).toBe('jan-luka');
    tearDownApp();
    setUpApp();
    window.localStorage.setItem('reziproq.demo-person', 'unbekannt');
    renderAt('/demo/als/unbekannt');
    expect(await screen.findByText('Keine Demo-Sitzung')).toBeTruthy();
    await waitFor(() => expect(window.localStorage.getItem('reziproq.demo-person')).toBeNull());
    expect(demoPersonToRestart()).toBeNull();
  });

  it('der Neustart führt mit Rückweg zurück, nie aus der Anmeldung heraus', async () => {
    expect(
      demoRestartHref('jan-luka', {
        pathname: '/beziehungen',
        search: '?linse=segmente',
        hash: '',
      }),
    ).toBe('/demo/als/jan-luka?zurueck=%2Fbeziehungen%3Flinse%3Dsegmente');
    expect(demoRestartHref('jan-luka', { pathname: '/', search: '', hash: '' })).toBe(
      '/demo/als/jan-luka',
    );
    expect(
      demoRestartHref('jan-luka', { pathname: '/auth/callback', search: '?code=1', hash: '' }),
    ).toBe('/demo/als/jan-luka');
    const leave = vi.fn();
    render(
      <LocaleProvider>
        <DemoSignInPage person="jan-luka" returnTo="/beziehungen?linse=segmente" leave={leave} />
      </LocaleProvider>,
    );
    await waitFor(() => expect(leave).toHaveBeenCalledWith('/beziehungen?linse=segmente'));
    // Fremde Ziele führen auf die Startseite (safeReturnTo)
    cleanup();
    const away = vi.fn();
    render(
      <LocaleProvider>
        <DemoSignInPage person="jan-luka" returnTo="https://example.com" leave={away} />
      </LocaleProvider>,
    );
    await waitFor(() => expect(away).toHaveBeenCalledWith('/'));
  });
});
