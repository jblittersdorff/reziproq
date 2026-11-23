import { useRouterState } from '@tanstack/react-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { oidcScope, signedOut, signInState, zitadelSettings } from '@/lib/auth';
import { restoreWhenReady, takeDraft } from '@/lib/draft';
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
  const userId = auth.user?.profile?.sub;

  // Nach der Neuanmeldung (UMB-02) die Felder aus dem Entwurf füllen, sobald sie erscheinen.
  // Nur für dieselbe Person und dieselbe Adresse; danach ist der Entwurf gelöscht.
  useEffect(() => {
    if (userId === undefined) return;
    const draft = takeDraft({ path: here, userId, now: Date.now() });
    if (!draft) return;
    return restoreWhenReady(document.body, draft);
  }, [userId, here]);

  // Ohne Sitzung (auch nach dem Neuladen, die Tokens liegen nur im Speicher) geht es direkt zu
  // Zitadel; danach zurück auf genau diese Seite.
  const needsLogin =
    !auth.isLoading && !auth.error && !auth.user && !auth.activeNavigator && !justSignedOut;
  useEffect(() => {
    if (!needsLogin || redirecting.current) return;
    redirecting.current = true;
    void auth.signinRedirect({ state: signInState(here) });
  }, [needsLogin, auth, here]);

  // IN-02: Mit Mail aus einer Domain mit Firmenanmeldung geht es direkt zu Microsoft oder Google
  // (Zitadel-Scope für den Anbieter); sonst zur Anmeldung von Zitadel wie bisher.
  const signIn = (hint?: { email: string; scope: string | null }) => {
    signedOut.clear();
    void auth.signinRedirect({
      state: signInState(here),
      ...(hint?.email ? { login_hint: hint.email } : {}),
      ...(hint?.scope ? { scope: `${oidcScope} ${hint.scope}` } : {}),
    });
  };

  // Bis die Anmeldung abgeschlossen ist, nur der ruhige Ladezustand, nie Inhalte. Ist schon jemand
  // angemeldet (z. B. während die Erneuerung läuft), bleibt die Seite stehen.
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
          <AuthFailed action={<Button onClick={() => signIn()}>{t.auth.retry}</Button>} />
        ) : (
          <SignIn onSignIn={signIn} />
        )}
      </AuthPage>
    );
  }
  // Erneuerung gescheitert: Seite bleibt stehen, oben im Seitenfluss der Hinweis zum neu Anmelden.
  const renewalFailed = auth.user.expired || auth.error?.source === 'renewSilent';
  return (
    <>
      {renewalFailed && <ReauthNotice />}
      {children}
    </>
  );
}
