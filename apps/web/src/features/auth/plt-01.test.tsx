// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signedOut } from '@/lib/auth';
import { anna, api, renderAt, setUpApp, signedIn, tearDownApp } from '@/testing/app-harness';

// Tests zu docs/specs/PLT-01.md, die nur die Oberfläche brauchen. Den Weg über ein nachgebautes
// Zitadel (Login, Erneuerung, Abmelden) prüft e2e/plt-01.spec.ts im Browser.

// Nachgebauter Login, auf den die Oberfläche hört wie auf react-oidc-context: Ändert ein Test den
// Zustand, zeichnet sich die Seite neu (z. B. wenn die Erneuerung im Hintergrund scheitert).
const auth = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  listeners: new Set<() => void>(),
  set(next: Record<string, unknown>) {
    this.state = next;
    for (const listener of this.listeners) listener();
  },
}));
vi.mock('react-oidc-context', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    useAuth: () =>
      useSyncExternalStore(
        (listener) => {
          auth.listeners.add(listener);
          return () => auth.listeners.delete(listener);
        },
        () => auth.state,
      ),
    AuthProvider: ({ children }: { children: unknown }) => children,
  };
});
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  zitadelSettings: { issuer: 'https://zitadel.test', clientId: 'web-client' },
}));

beforeEach(() => {
  auth.state = signedIn;
  setUpApp();
});

afterEach(tearDownApp);

describe('Nach dem Abmelden', () => {
  it('zeigt die Startseite mit „Anmelden“, statt sofort wieder zu Zitadel zu leiten', async () => {
    const signinRedirect = vi.fn();
    auth.state = { ...signedIn, user: null, signinRedirect };
    signedOut.mark();
    renderAt('/uebersicht');

    const button = await screen.findByRole('button', { name: 'Anmelden' });
    expect(signinRedirect).not.toHaveBeenCalled();
    expect(document.getElementById('inhalt')).toBeNull();

    // Ein Klick startet die nächste Anmeldung und vergisst den Merker.
    fireEvent.click(button);
    expect(signinRedirect).toHaveBeenCalledWith({ state: { returnTo: '/uebersicht' } });
    expect(signedOut.isSet()).toBe(false);
  });
});

describe('Geschützte Seiten zeigen vor abgeschlossener Anmeldung keine Inhalte', () => {
  it.each([
    ['solange die Sitzung geprüft wird', { isLoading: true, user: null }],
    [
      'solange die Weiterleitung zu Zitadel läuft',
      { user: null, activeNavigator: 'signinRedirect' },
    ],
  ])('%s', async (_case, state) => {
    auth.state = { ...signedIn, ...state };
    renderAt('/lieferanten');
    expect((await screen.findByRole('status')).textContent).toBe('Anmeldung wird geprüft …');
    expect(document.getElementById('inhalt')).toBeNull();
    expect(screen.queryByText('Rheintal Elektronik GmbH (Demo)')).toBeNull();
  });
});

describe('Erneuerung gescheitert', () => {
  const renewFailed = {
    ...signedIn,
    error: { source: 'renewSilent', message: 'invalid_grant' },
  };

  it('zeigt „Bitte melde dich neu an“ über der Seite, die Eingaben bleiben erhalten', async () => {
    auth.state = signedIn;
    renderAt('/lieferanten');
    const search = await screen.findByRole('searchbox', { name: /Lieferant/ });
    fireEvent.change(search, { target: { value: 'Silesia' } });

    act(() => auth.set(renewFailed));

    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toContain('Bitte melde dich neu an');
    expect((screen.getByRole('searchbox', { name: /Lieferant/ }) as HTMLInputElement).value).toBe(
      'Silesia',
    );
  });

  it('meldet im kleinen Fenster neu an und meldet den Login der API', async () => {
    const signinPopup = vi.fn(async () => ({ access_token: 'access-token-1' }));
    const signinRedirect = vi.fn();
    auth.state = { ...renewFailed, signinPopup, signinRedirect };
    renderAt('/uebersicht');

    fireEvent.click(await screen.findByRole('button', { name: 'Neu anmelden' }));
    await waitFor(() => expect(signinPopup).toHaveBeenCalled());
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/me/anmeldung',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(signinRedirect).not.toHaveBeenCalled();
  });

  it('leitet normal weiter, wenn der Browser das Fenster sperrt', async () => {
    const signinPopup = vi.fn(async () => {
      throw new Error('Popup blocked by user');
    });
    const signinRedirect = vi.fn();
    auth.state = { ...renewFailed, signinPopup, signinRedirect };
    renderAt('/uebersicht');

    fireEvent.click(await screen.findByRole('button', { name: 'Neu anmelden' }));
    await waitFor(() => expect(signinRedirect).toHaveBeenCalled());
  });
});

describe('Rollen in den Einstellungen', () => {
  it('nennt die Rollen aus dem Token', async () => {
    api.me = { ...anna, roles: ['admin', 'betreiber'] };
    renderAt('/einstellungen');
    expect(await screen.findByText('Deine Rollen in Reziproq')).toBeDefined();
    expect(screen.getByText('admin')).toBeDefined();
    expect(screen.getByText('betreiber')).toBeDefined();
  });

  it('sagt ohne Rollen, was in Zitadel zu prüfen ist', async () => {
    api.me = { ...anna, roles: [] };
    renderAt('/einstellungen');
    expect(await screen.findByText('Keine')).toBeDefined();
    expect(screen.getByText(/Rollen bei Authentifizierung mitgeben/)).toBeDefined();
  });
});
