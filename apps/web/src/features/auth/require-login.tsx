import { useRouterState } from '@tanstack/react-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { signedOut, signInState, zitadelSettings } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { AuthChecking, AuthFailed, AuthNotConfigured, AuthPage, SignIn } from './auth-states';
import { ReauthNotice } from './reauth-notice';

/**
 * Zeigt den Inhalt nur mit gültigem Login, sonst die Anmeldung.
 * Gilt für alle Seiten des Rahmens (PLT-11) und für den Styleguide (PLT-10).
 */
export function RequireLogin({ children }: { children: ReactNode }) {
  // Ohne Zitadel-Werte gibt es keinen AuthProvider, also auch kein useAuth.
  if (!zitadelSettings) {
    return (
      <AuthPage>
        <AuthNotConfigured />
      </AuthPage>
    );
  }
  return <AuthGate>{children}</AuthGate>;
}

function AuthGate({ children }: { children: ReactNode }) {
  const t = useT();
  const auth = useAuth();
  // Nach dem Abmelden zeigt die App „Anmelden“, statt sofort wieder zu Zitadel zu leiten (PLT-01).
  const [justSignedOut] = useState(() => signedOut.isSet());
  const redirecting = useRef(false);
  const here = useRouterState({ select: (state) => state.location.href });

  // Ohne Sitzung (auch nach dem Neuladen, die Tokens liegen nur im Speicher) geht es direkt zu
  // Zitadel; danach zurück auf genau diese Seite.
  const needsLogin =
    !auth.isLoading && !auth.error && !auth.user && !auth.activeNavigator && !justSignedOut;
  useEffect(() => {
    if (!needsLogin || redirecting.current) return;
    redirecting.current = true;
    void auth.signinRedirect({ state: signInState(here) });
  }, [needsLogin, auth, here]);

  const signIn = () => {
    signedOut.clear();
    void auth.signinRedirect({ state: signInState(here) });
  };

  // Bis die Anmeldung abgeschlossen ist, nur der ruhige Ladezustand, nie Inhalte. Ist schon jemand
  // angemeldet (z. B. Neuanmeldung im Popup), bleibt die Seite stehen, damit nichts verloren geht.
  if (!auth.user && (auth.isLoading || needsLogin || auth.activeNavigator)) {
    return (
      <AuthPage>
        <AuthChecking />
      </AuthPage>
    );
  }
  if (!auth.user) {
    return (
      <AuthPage>
        {auth.error ? (
          <AuthFailed action={<Button onClick={signIn}>{t.auth.retry}</Button>} />
        ) : (
          <SignIn onSignIn={signIn} />
        )}
      </AuthPage>
    );
  }
  // Erneuerung gescheitert: Seite bleibt stehen, darüber der Hinweis zum neu Anmelden.
  const renewalFailed = auth.user.expired || auth.error?.source === 'renewSilent';
  return (
    <>
      {children}
      {renewalFailed && <ReauthNotice />}
    </>
  );
}
