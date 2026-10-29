import { Link, Navigate } from '@tanstack/react-router';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { zitadelSettings } from '@/lib/auth';
import { useMessages } from '@/lib/i18n';
import { AuthChecking, AuthFailed, AuthNotConfigured } from './auth-states';
import { authMessages } from './messages';

/**
 * Hierhin leitet Zitadel nach dem Login zurück. Den Code tauscht react-oidc-context gegen Tokens;
 * danach geht es über onSigninCallback zur Startseite.
 */
export function CallbackPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      {zitadelSettings ? <CallbackState /> : <AuthNotConfigured />}
    </main>
  );
}

function CallbackState() {
  const t = useMessages(authMessages);
  const auth = useAuth();

  if (auth.error) {
    return (
      <AuthFailed
        action={
          <Button variant="outline" asChild>
            <Link to="/">{t.backHome}</Link>
          </Button>
        }
      />
    );
  }
  if (auth.isLoading) return <AuthChecking />;
  // Ohne laufenden Login (z. B. direkt aufgerufen) gibt es hier nichts zu tun.
  return <Navigate to="/" replace />;
}
