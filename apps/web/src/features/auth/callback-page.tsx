import { Link, Navigate } from '@tanstack/react-router';
import { useState } from 'react';
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
  // Beim ersten Zeichnen festhalten: Später hat onSigninCallback die Adresse schon geändert.
  const [loginRunning] = useState(hasCode);

  if (auth.error) {
    return (
      <AuthFailed
        action={
          <Button variant="outline" asChild>
            <Link to="/uebersicht">{t.auth.backHome}</Link>
          </Button>
        }
      />
    );
  }
  // Mit Code in der Adresse führt onSigninCallback (main.tsx) zur angefragten Seite zurück.
  // Selbst weiterzuleiten würde damit um die Wette laufen und sie überschreiben (PLT-01).
  if (auth.isLoading || loginRunning) return <AuthChecking />;
  // Ohne laufenden Login (z. B. direkt aufgerufen) gibt es hier nichts zu tun.
  return <Navigate to="/uebersicht" replace />;
}

function hasCode(): boolean {
  return new URLSearchParams(window.location.search).has('code');
}
