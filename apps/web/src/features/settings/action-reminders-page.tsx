import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { StatusLine } from '@/components/ui/status-line';
import { useMe } from '@/features/auth/use-me';
import { useCan } from '@/features/auth/use-permissions';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { actionReminderSettingQueryOptions, saveActionReminderSetting } from '@/lib/api';
import { useT } from '@/lib/i18n';

/** Einstellungen › Erinnerungen (QBR-04): Tage vor der Frist, für Admins beider Seiten. */
export function ActionRemindersPage() {
  const t = useT();
  const text = t.settings.actionReminders;
  const me = useMe();
  const canManage = useCan('einstellungen.verwalten');
  return (
    <>
      <PagePath
        trail={[
          { label: t.profile.title, href: '/profil' },
          { label: t.settings.title, href: '/einstellungen' },
        ]}
        current={text.navTitle}
      />
      <PageHeader title={text.title} purpose={text.purpose} />
      {me.isError ? (
        <ErrorState title={t.user.failed} />
      ) : !me.data ? (
        <LoadingState label={text.loading} />
      ) : canManage ? (
        <ReminderForm />
      ) : (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {t.settings.adminOnly}
        </p>
      )}
    </>
  );
}

function ReminderForm() {
  const text = useT().settings.actionReminders;
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const queryClient = useQueryClient();
  const query = useQuery({
    ...actionReminderSettingQueryOptions(accessToken),
    enabled: accessToken !== '',
  });
  const [draft, setDraft] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);

  if (query.isError) return <ErrorState title={text.failed} />;
  if (!query.data) return <LoadingState label={text.loading} />;
  const days = draft ?? query.data.reminderDays;

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setFailed(false);
    try {
      queryClient.setQueryData(
        actionReminderSettingQueryOptions(accessToken).queryKey,
        await saveActionReminderSetting(accessToken, { reminderDays: days }),
      );
      setDraft(null);
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="flex max-w-2xl flex-col gap-6" onSubmit={(event) => void save(event)}>
      {saved && <StatusLine message={text.saved} />}
      {failed && <StatusLine message={text.saveFailed} tone="warning" />}
      <SettingsGroup>
        <SettingsRow label={text.days} description={text.daysHint} htmlFor="reminder-days">
          <Input
            id="reminder-days"
            type="number"
            min={1}
            max={30}
            step={1}
            required
            value={days}
            onChange={(event) => setDraft(Number(event.target.value))}
          />
        </SettingsRow>
      </SettingsGroup>
      <Button className="self-start" loading={saving} type="submit">
        {text.save}
      </Button>
    </form>
  );
}
