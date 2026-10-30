import { LogInIcon } from 'lucide-react';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { reportLogin } from '@/lib/api';
import { signInState } from '@/lib/auth';
import { useT } from '@/lib/i18n';

/**
 * Erscheint, wenn die Erneuerung des Tokens im Hintergrund scheitert (PLT-01). Die Seite darunter
 * bleibt stehen, damit nichts Eingegebenes verloren geht. Neu angemeldet wird im kleinen Fenster;
 * nur wenn der Browser es sperrt, folgt eine normale Weiterleitung.
 */
export function ReauthNotice() {
  const t = useT();
  const auth = useAuth();

  const signInAgain = async () => {
    try {
      const user = await auth.signinPopup();
      void reportLogin(user.access_token);
    } catch (error) {
      if (error instanceof Error && error.message === 'Popup blocked by user') {
        await auth.signinRedirect({ state: signInState() });
      }
      // Fenster geschlossen: Der Hinweis bleibt, man kann es erneut versuchen.
    }
  };

  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-lg flex-col gap-3 rounded-xl bg-popover/90 p-4 text-popover-foreground shadow-lg backdrop-blur sm:flex-row sm:items-center"
    >
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-semibold text-base">{t.auth.reauthTitle}</p>
        <p className="text-muted-foreground text-sm">{t.auth.reauthDescription}</p>
      </div>
      <Button onClick={() => void signInAgain()}>
        <LogInIcon />
        {t.auth.reauthAction}
      </Button>
    </div>
  );
}
