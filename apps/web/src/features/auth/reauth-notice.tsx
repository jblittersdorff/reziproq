import { useRouterState } from '@tanstack/react-router';
import { LogInIcon } from 'lucide-react';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { StatusLine } from '@/components/ui/status-line';
import { signInState } from '@/lib/auth';
import { collectDraft, saveDraft } from '@/lib/draft';
import { useT } from '@/lib/i18n';

/**
 * Erscheint, wenn die Erneuerung des Tokens im Hintergrund scheitert (PLT-01). Steht ganz oben im
 * Seitenfluss, ohne Fenster und ohne Overlay (UMB-02). Der Knopf merkt sich die offenen Felder als
 * Entwurf und leitet zu Zitadel; nach der Rückkehr füllt RequireLogin sie wieder.
 */
export function ReauthNotice() {
  const t = useT();
  const auth = useAuth();
  const path = useRouterState({ select: (state) => state.location.href });

  const signInAgain = () => {
    saveDraft(
      collectDraft(document, { path, userId: auth.user?.profile?.sub ?? '', now: Date.now() }),
    );
    void auth.signinRedirect({ state: signInState(path) });
  };

  return (
    <div className="px-4 pt-4">
      <StatusLine
        tone="warning"
        message={t.auth.reauthTitle}
        description={t.auth.reauthDescription}
        action={
          <Button onClick={signInAgain}>
            <LogInIcon />
            {t.auth.reauthAction}
          </Button>
        }
      />
    </div>
  );
}
