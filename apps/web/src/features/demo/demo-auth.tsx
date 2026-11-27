import type { DemoSession } from '@reziproq/shared';
import { type ReactNode, useEffect, useMemo } from 'react';
import { AuthContext, type AuthContextProps } from 'react-oidc-context';
import { clearDemoSession, demoRestartHref, demoSessionEnding, leaveTo } from '@/lib/demo-session';

/**
 * DM-01, E-K0-05 (K1-b.2): Anmeldung einer Demo-Person ohne Zitadel. Liefert denselben Kontext wie
 * der AuthProvider von Zitadel, damit jede Seite unverändert useAuth() nutzt: das Token der
 * Demo-Sitzung, Name und ID der Person. Abmelden beendet die Sitzung in diesem Tab. Die API nimmt
 * das Token nur für Personen eines Demo-Mandanten an und nie im Betrieb. Kurz vor dem Ablauf startet
 * die Sitzung als dieselbe Person neu und kehrt auf die Seite zurück (Wunsch des Gründers, 27.11.):
 * geprüft jede Minute und wenn der Tab wieder sichtbar wird, denn ein langer Zeitgeber steht im
 * Ruhezustand des Rechners still.
 */
export function DemoAuthProvider({
  session,
  children,
  leave = leaveTo,
}: {
  session: DemoSession;
  children: ReactNode;
  /** Wohin der Neustart führt; in Tests ersetzbar */
  leave?: (href: string) => void;
}) {
  useEffect(() => {
    const renewIfEnding = () => {
      if (demoSessionEnding(session)) {
        leave(demoRestartHref(session.person.id, window.location));
      }
    };
    const timer = window.setInterval(renewIfEnding, 60_000);
    document.addEventListener('visibilitychange', renewIfEnding);
    window.addEventListener('focus', renewIfEnding);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', renewIfEnding);
      window.removeEventListener('focus', renewIfEnding);
    };
  }, [session, leave]);
  const value = useMemo(() => {
    const end = async () => {
      clearDemoSession();
      window.location.assign('/');
    };
    const expiresAt = Math.floor(new Date(session.expiresAt).getTime() / 1000);
    return {
      user: {
        access_token: session.accessToken,
        token_type: 'Bearer',
        profile: { sub: session.person.id, name: session.person.name },
        expires_at: expiresAt,
        expired: false,
        scopes: [],
        state: undefined,
      },
      isAuthenticated: true,
      isLoading: false,
      activeNavigator: undefined,
      error: undefined,
      signinRedirect: async () => undefined,
      signinSilent: async () => null,
      signoutRedirect: end,
      signoutSilent: end,
      removeUser: async () => clearDemoSession(),
    } as unknown as AuthContextProps;
  }, [session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
