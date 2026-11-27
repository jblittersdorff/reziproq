import type { DemoSession } from '@reziproq/shared';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { AuthPage } from '@/features/auth/auth-states';
import { startDemoSession } from '@/lib/api';
import { safeReturnTo } from '@/lib/auth';
import { forgetDemoPerson, leaveTo, saveDemoSession } from '@/lib/demo-session';
import { useMessages } from '@/lib/i18n';
import { demoMessages } from './demo-messages';

/**
 * DM-01, E-K0-05 (K1-b.2): /demo/als/<Person> startet eine Demo-Sitzung für eine Person des
 * Demo-Mandanten, ohne Zitadel. Danach lädt die App neu, damit sie die Sitzung statt Zitadel nutzt.
 * Die Demo-Regie (K1-g) wechselt die Rolle über dieselbe Adresse. Mit `zurueck` (Neustart einer
 * abgelaufenen Sitzung) geht es danach auf die Seite zurück, auf der die Person war. Scheitert der
 * Start, vergisst der Browser die Person, damit kein Neustart im Kreis läuft.
 */
export function DemoSignInPage({
  person,
  returnTo,
  leave = leaveTo,
}: {
  person: string;
  returnTo?: string;
  /** Wohin es nach dem Start geht; in Tests ersetzbar */
  leave?: (href: string) => void;
}) {
  const text = useMessages(demoMessages);
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'failed' } | { kind: 'started'; session: DemoSession }
  >({ kind: 'loading' });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startDemoSession(person).then(
      (session) => {
        saveDemoSession(session);
        setState({ kind: 'started', session });
        leave(safeReturnTo(returnTo));
      },
      () => {
        forgetDemoPerson();
        setState({ kind: 'failed' });
      },
    );
  }, [person, returnTo, leave]);

  return (
    <AuthPage>
      {state.kind === 'loading' && <LoadingState label={text.starting} />}
      {state.kind === 'failed' && (
        <ErrorState
          title={text.failedTitle}
          description={text.failedText}
          action={
            <Button variant="secondary" asChild>
              <a href="/">{text.home}</a>
            </Button>
          }
        />
      )}
      {state.kind === 'started' && (
        <div className="flex flex-col items-start gap-3">
          <p role="status" className="text-base text-ink">
            {text.started(state.session.person.name, state.session.person.orgName)}
          </p>
          <Button asChild>
            <a href="/">{text.open}</a>
          </Button>
        </div>
      )}
    </AuthPage>
  );
}
