import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { useCan } from '@/features/auth/use-permissions';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { hintSettingsQueryOptions, saveHintSettings } from '@/lib/api';
import { useT } from '@/lib/i18n';

export { useHintWhy } from './hint-panel';
export { HintPage, HintsPage } from './hints-list';

function useAccessToken() {
  const auth = useAuth();
  return auth.user?.access_token ?? '';
}

/** Einstellungen › Hinweise: Schwellwerte, nur Admins (FS-01). */
export function HintSettingsPage() {
  const t = useT();
  const text = t.hints;
  const accessToken = useAccessToken();
  const canEdit = useCan('hinweise.einstellen');
  const queryClient = useQueryClient();
  const options = hintSettingsQueryOptions(accessToken);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const [draft, setDraft] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const value = draft ?? query.data?.maxFocusPerSro ?? 8;

  return (
    <>
      <PagePath
        trail={[
          { label: t.profile.title, href: '/profil' },
          { label: t.settings.title, href: '/einstellungen' },
        ]}
        current={text.settingsTitle}
      />
      <PageHeader title={text.settingsTitle} purpose={text.settingsPurpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : !canEdit ? (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {t.settings.adminOnly}
        </p>
      ) : (
        <form
          className="flex max-w-xl flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaved(false);
            setFailed(false);
            try {
              queryClient.setQueryData(
                options.queryKey,
                await saveHintSettings(accessToken, { maxFocusPerSro: value }),
              );
              setDraft(null);
              setSaved(true);
            } catch {
              setFailed(true);
            }
          }}
        >
          {saved && <StatusLine message={text.saved} />}
          {failed && <StatusLine message={text.failedSave} tone="warning" />}
          <FormField label={text.maxFocus} hint={text.maxFocusHint}>
            {(field) => (
              <Input
                {...field}
                type="number"
                min={1}
                max={200}
                value={value}
                onChange={(event) => setDraft(Number(event.target.value))}
              />
            )}
          </FormField>
          <Button type="submit" className="self-start">
            {text.save}
          </Button>
        </form>
      )}
    </>
  );
}
