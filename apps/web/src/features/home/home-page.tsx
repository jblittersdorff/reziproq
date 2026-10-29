import { IconLogin2, IconLogout } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { AuthChecking, AuthFailed, AuthNotConfigured } from '@/features/auth/auth-states';
import { ApiError, healthQueryOptions, meQueryOptions } from '@/lib/api';
import { zitadelSettings } from '@/lib/auth';
import { useMessages } from '@/lib/i18n';
import { homeMessages } from './messages';

export function HomePage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-16">
      <h1 className="font-semibold text-xl">Reziproq</h1>
      {/* Ohne Zitadel-Werte gibt es keinen AuthProvider, also auch kein useAuth. */}
      {zitadelSettings ? <SignedInOrOut /> : <AuthNotConfigured />}
    </main>
  );
}

function SignedInOrOut() {
  const t = useMessages(homeMessages);
  const auth = useAuth();

  if (auth.isLoading) return <AuthChecking />;

  if (auth.error) {
    return <AuthFailed action={<SignInButton onClick={() => auth.signinRedirect()} />} />;
  }

  if (!auth.user || auth.user.expired) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-muted-foreground">{t.welcome}</p>
        <SignInButton onClick={() => auth.signinRedirect()} />
      </div>
    );
  }

  return <Account accessToken={auth.user.access_token} onSignOut={() => auth.signoutRedirect()} />;
}

function SignInButton({ onClick }: { onClick: () => void }) {
  const t = useMessages(homeMessages);
  return (
    <Button onClick={onClick}>
      <IconLogin2 />
      {t.signIn}
    </Button>
  );
}

function Account({ accessToken, onSignOut }: { accessToken: string; onSignOut: () => void }) {
  const t = useMessages(homeMessages);
  const me = useQuery(meQueryOptions(accessToken));
  const health = useQuery(healthQueryOptions());

  const missingClaims = me.error instanceof ApiError && me.error.status === 401;

  return (
    <div className="flex flex-col gap-6">
      <SettingsGroup title={t.account}>
        <SettingsRow label={t.name}>
          <AccountValue isPending={me.isPending} value={me.data?.name} loading={t.loading} />
        </SettingsRow>
        <SettingsRow label={t.email}>
          <AccountValue isPending={me.isPending} value={me.data?.email} loading={t.loading} />
        </SettingsRow>
        <SettingsRow label={t.connection}>
          {health.isPending ? (
            <Badge>{t.apiChecking}</Badge>
          ) : health.isSuccess ? (
            <Badge variant="success">{t.apiOk}</Badge>
          ) : (
            <Badge variant="danger">{t.apiDown}</Badge>
          )}
        </SettingsRow>
      </SettingsGroup>
      {me.isError && (
        <p role="alert" className="text-destructive text-sm">
          {missingClaims ? t.meMissingClaims : t.meFailed}
        </p>
      )}
      <div>
        <Button variant="outline" onClick={onSignOut}>
          <IconLogout />
          {t.signOut}
        </Button>
      </div>
    </div>
  );
}

function AccountValue({
  isPending,
  value,
  loading,
}: {
  isPending: boolean;
  value: string | undefined;
  loading: string;
}) {
  if (isPending) return <span className="text-muted-foreground">{loading}</span>;
  return <span className="truncate">{value ?? '–'}</span>;
}
