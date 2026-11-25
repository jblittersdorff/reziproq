import type { DemoSession } from '@reziproq/shared';
import { type ReactNode, useMemo } from 'react';
import { AuthContext, type AuthContextProps } from 'react-oidc-context';
import { clearDemoSession } from '@/lib/demo-session';

/**
 * DM-01, E-K0-05 (K1-b.2): Anmeldung einer Demo-Person ohne Zitadel. Liefert denselben Kontext wie
 * der AuthProvider von Zitadel, damit jede Seite unverändert useAuth() nutzt: das Token der
 * Demo-Sitzung, Name und ID der Person. Abmelden beendet die Sitzung in diesem Tab. Die API nimmt
 * das Token nur für Personen eines Demo-Mandanten an und nie im Betrieb.
 */
export function DemoAuthProvider({
  session,
  children,
}: {
  session: DemoSession;
  children: ReactNode;
}) {
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
