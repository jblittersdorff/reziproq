import { LogInIcon, TriangleAlertIcon, UnplugIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';
import { useT } from '@/lib/i18n';

/** Rahmen für alles vor dem Login: schmale Spalte mit dem Namen der App. */
export function AuthPage({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <h1 className="font-semibold text-xl">{t.app.name}</h1>
      {children}
    </main>
  );
}

/** Ladezustand, solange die Sitzung geprüft oder der Login abgeschlossen wird. */
export function AuthChecking() {
  const t = useT();
  return <LoadingState label={t.auth.checking} />;
}

export function AuthFailed({ action }: { action: ReactNode }) {
  const t = useT();
  return (
    <EmptyState
      icon={<TriangleAlertIcon />}
      title={t.auth.failedTitle}
      description={t.auth.failedDescription}
      action={action}
    />
  );
}

export function AuthNotConfigured() {
  const t = useT();
  return (
    <EmptyState
      icon={<UnplugIcon />}
      title={t.auth.notConfiguredTitle}
      description={t.auth.notConfiguredDescription}
    />
  );
}

export function SignIn({ onSignIn }: { onSignIn: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-muted-foreground">{t.auth.welcome}</p>
      <Button onClick={onSignIn}>
        <LogInIcon />
        {t.auth.signIn}
      </Button>
    </div>
  );
}
