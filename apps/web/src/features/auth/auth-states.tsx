import { LogInIcon, TriangleAlertIcon, UnplugIcon } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { Logo } from '@/components/ui/brand-mark';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { ssoHint } from '@/lib/api';
import { useT } from '@/lib/i18n';

/** Rahmen für alles vor dem Login: schmale Spalte mit dem Namen der App. */
export function AuthPage({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <h1>
        <Logo name={t.app.name} />
      </h1>
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

/**
 * Anmelden (PLT-01) mit Feld Mail (IN-02): Gehört die Domain zu einer Organisation mit
 * Firmenanmeldung, führt Weiter direkt zu Microsoft oder Google, sonst zu Zitadel wie bisher.
 */
export function SignIn({
  onSignIn,
}: {
  onSignIn: (hint?: { email: string; scope: string | null }) => void;
}) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (!value) return onSignIn();
    setBusy(true);
    const hint = await ssoHint(value).catch(() => ({ scope: null }));
    onSignIn({ email: value, scope: hint.scope });
  };
  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col items-stretch gap-4">
      <p className="text-muted-foreground">{t.auth.welcome}</p>
      <FormField label={t.auth.emailLabel} hint={t.auth.emailHint}>
        {(field) => (
          <Input
            {...field}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        )}
      </FormField>
      <Button type="submit" className="self-start" loading={busy}>
        <LogInIcon />
        {email.trim() ? t.auth.continue : t.auth.signIn}
      </Button>
    </form>
  );
}
