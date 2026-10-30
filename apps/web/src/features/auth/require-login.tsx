import type { ReactNode } from 'react';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { signInState, zitadelSettings } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { AuthChecking, AuthFailed, AuthNotConfigured, AuthPage, SignIn } from './auth-states';

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

  if (auth.isLoading) {
    return (
      <AuthPage>
        <AuthChecking />
      </AuthPage>
    );
  }
  if (auth.error) {
    return (
      <AuthPage>
        <AuthFailed
          action={
            <Button onClick={() => void auth.signinRedirect({ state: signInState() })}>
              {t.auth.retry}
            </Button>
          }
        />
      </AuthPage>
    );
  }
  if (!auth.user || auth.user.expired) {
    return (
      <AuthPage>
        <SignIn onSignIn={() => void auth.signinRedirect({ state: signInState() })} />
      </AuthPage>
    );
  }
  return children;
}
