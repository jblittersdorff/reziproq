import type { CycleSetting } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Input } from '@/components/ui/input';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { StatusLine } from '@/components/ui/status-line';
import { useCan } from '@/features/auth/use-permissions';
import { useMe } from '@/features/auth/use-me';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { cycleSettingsQueryOptions, updateCycleSettings } from '@/lib/api';
import { useT } from '@/lib/i18n';

export function CycleSettingsPage() {
  const t = useT();
  const me = useMe();
  const canManage = useCan('einstellungen.verwalten');

  return (
    <>
      <PagePath
        trail={[
          { label: t.profile.title, href: '/profil' },
          { label: t.settings.title, href: '/einstellungen' },
        ]}
        current={t.settings.cycleSettings.navTitle}
      />
      <PageHeader
        title={t.settings.cycleSettings.title}
        purpose={t.settings.cycleSettings.purpose}
      />
      {me.isError ? (
        <ErrorState title={t.user.failed} />
      ) : !me.data ? (
        <LoadingState label={t.settings.cycleSettings.loading} />
      ) : canManage ? (
        <CycleSettingsForm />
      ) : (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {t.settings.adminOnly}
        </p>
      )}
    </>
  );
}

function CycleSettingsForm() {
  const t = useT();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({
    ...cycleSettingsQueryOptions(accessToken),
    enabled: accessToken !== '',
  });
  const [draft, setDraft] = useState<CycleSetting[]>([]);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (query.data) setDraft(query.data.settings);
  }, [query.data]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFailed(false);
    setSaved(false);
    try {
      const result = await updateCycleSettings(accessToken, { settings: draft });
      setDraft(result.settings);
      await queryClient.invalidateQueries({ queryKey: ['cycle-settings'] });
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  if (query.isError) return <ErrorState title={t.settings.cycleSettings.failed} />;
  if (!query.data) return <LoadingState label={t.settings.cycleSettings.loading} />;

  return (
    <form className="flex flex-col gap-6" onSubmit={(event) => void save(event)}>
      {saved && <StatusLine message={t.settings.cycleSettings.saved} />}
      {failed && <StatusLine message={t.settings.cycleSettings.saveFailed} tone="warning" />}
      <div className="grid gap-4 lg:grid-cols-2">
        {draft.map((setting) => {
          const label = t.workspace.cycle.steps[setting.step];
          return (
            <SettingsGroup key={setting.step} title={label}>
              <SettingsRow
                label={t.settings.cycleSettings.weeks}
                description={t.settings.cycleSettings.weeksHint}
                htmlFor={`${setting.step}-weeks`}
              >
                <Input
                  id={`${setting.step}-weeks`}
                  aria-label={`${label}: ${t.settings.cycleSettings.weeks}`}
                  type="number"
                  min={-104}
                  max={104}
                  step={1}
                  required
                  value={setting.weeksRelativeToJbp}
                  onChange={(event) =>
                    setDraft((current) =>
                      current.map((entry) =>
                        entry.step === setting.step
                          ? { ...entry, weeksRelativeToJbp: Number(event.target.value) }
                          : entry,
                      ),
                    )
                  }
                />
              </SettingsRow>
              <SettingsRow
                label={t.settings.cycleSettings.reminder}
                htmlFor={`${setting.step}-reminder`}
              >
                <Input
                  id={`${setting.step}-reminder`}
                  aria-label={`${label}: ${t.settings.cycleSettings.reminder}`}
                  type="number"
                  min={0}
                  max={365}
                  step={1}
                  required
                  value={setting.reminderDaysBefore}
                  onChange={(event) =>
                    setDraft((current) =>
                      current.map((entry) =>
                        entry.step === setting.step
                          ? { ...entry, reminderDaysBefore: Number(event.target.value) }
                          : entry,
                      ),
                    )
                  }
                />
              </SettingsRow>
            </SettingsGroup>
          );
        })}
      </div>
      <Button className="self-start" loading={saving} type="submit">
        {t.settings.save}
      </Button>
    </form>
  );
}
