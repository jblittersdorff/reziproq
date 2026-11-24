// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react';
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
    renderAt('/heute');

    const button = await screen.findByRole('button', { name: 'Anmelden' });
    expect(signinRedirect).not.toHaveBeenCalled();
    expect(document.getElementById('inhalt')).toBeNull();

    // Ein Klick startet die nächste Anmeldung und vergisst den Merker.
    fireEvent.click(button);
    expect(signinRedirect).toHaveBeenCalledWith({ state: { returnTo: '/heute' } });
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

  it('zeigt „Bitte melde dich neu an“ oben im Seitenfluss, die Eingaben bleiben erhalten', async () => {
    auth.state = signedIn;
    renderAt('/lieferanten');
    const search = await screen.findByRole('searchbox', { name: /Lieferant/ });
    fireEvent.change(search, { target: { value: 'Silesia' } });

    act(() => auth.set(renewFailed));

    const notice = await screen.findByRole('alert');
    expect(notice.textContent).toContain('Bitte melde dich neu an');
    expect(notice.className).not.toMatch(/\bfixed\b/);
    expect((screen.getByRole('searchbox', { name: /Lieferant/ }) as HTMLInputElement).value).toBe(
      'Silesia',
    );
  });

  it('leitet ohne Fenster zu Zitadel weiter und kehrt zur selben Adresse zurück (UMB-02)', async () => {
    const signinPopup = vi.fn();
    const signinRedirect = vi.fn();
    auth.state = { ...renewFailed, signinPopup, signinRedirect };
    const open = vi.spyOn(window, 'open');
    renderAt('/beziehungen');

    fireEvent.click(await screen.findByRole('button', { name: 'Neu anmelden' }));
    expect(signinRedirect).toHaveBeenCalledWith({ state: { returnTo: '/beziehungen' } });
    expect(signinPopup).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});

describe('Rolle auf dem Profil (PLT-05)', () => {
  it('nennt die Rolle aus der Datenbank, Controlling und Betreiber', async () => {
    api.me = { ...anna, orgRole: 'admin', isControlling: true, isOperator: true };
    renderAt('/profil');
    expect(await screen.findByText('Deine Rolle')).toBeDefined();
    expect(screen.getByText('Admin')).toBeDefined();
    expect(screen.getByText('Controlling')).toBeDefined();
    expect(screen.getByText('Betreiber von Reziproq')).toBeDefined();
  });

  it('zeigt keinen Hinweis mehr auf Rollen in Zitadel', async () => {
    renderAt('/profil');
    expect(await screen.findByText('Nutzer')).toBeDefined();
    expect(screen.queryByText(/Zitadel/)).toBeNull();
  });
});
