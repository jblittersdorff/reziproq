import { Link, Navigate } from '@tanstack/react-router';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { zitadelSettings } from '@/lib/auth';
import { useT } from '@/lib/i18n';
import { AuthChecking, AuthFailed, AuthNotConfigured, AuthPage } from './auth-states';

/**
 * Hierhin leitet Zitadel nach dem Login zurück. Den Code tauscht react-oidc-context gegen Tokens;
 * danach geht es über onSigninCallback zur Startseite.
 */
export function CallbackPage() {
  return <AuthPage>{zitadelSettings ? <CallbackState /> : <AuthNotConfigured />}</AuthPage>;
}

function CallbackState() {
  const t = useT();
  const auth = useAuth();

  if (auth.error) {
    return (
      <AuthFailed
        action={
          <Button variant="outline" asChild>
            <Link to="/">{t.auth.backHome}</Link>
          </Button>
        }
      />
    );
  }
  if (auth.isLoading) return <AuthChecking />;
  // Ohne laufenden Login (z. B. direkt aufgerufen) gibt es hier nichts zu tun.
  return <Navigate to="/" replace />;
}
