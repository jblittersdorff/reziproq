import {
  type NotificationKind,
  type NotificationMode,
  type NotificationPrefs,
  notificationKinds,
  type QuietHours,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useId, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { SettingsGroup, SettingsRow } from '@/components/ui/settings-group';
import { StatusLine } from '@/components/ui/status-line';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import {
  linkTeams,
  notificationPrefsQueryOptions,
  saveNotificationOrganization,
  saveNotificationPrefs,
  unlinkTeams,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';

type Modes = NotificationPrefs['modes'];

/**
 * IN-06 Profil › Benachrichtigungen (nach Regeln, Formularseite wie Sprache): Teams verbinden, je
 * Anlass Teams und Mail mit Sofort, Zusammenfassung oder Aus, Ruhezeiten. Eine Hauptaktion:
 * Speichern. Admins schalten darunter Teams-App und Mailversand der Organisation.
 */
export function NotificationsPage() {
  const t = useT();
  const text = t.notifications;
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({
    ...notificationPrefsQueryOptions(accessToken),
    enabled: accessToken !== '',
  });

  return (
    <>
      <PagePath trail={[{ label: t.profile.title, href: '/profil' }]} current={text.title} />
      <PageHeader title={text.title} purpose={text.purpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : (
        <NotificationsForm prefs={query.data} accessToken={accessToken} />
      )}
    </>
  );
}

function NotificationsForm({
  prefs,
  accessToken,
}: {
  prefs: NotificationPrefs;
  accessToken: string;
}) {
  const t = useT();
  const text = t.notifications;
  const format = useFormat();
  const id = useId();
  const client = useQueryClient();
  const [modes, setModes] = useState<Modes>(prefs.modes);
  const [quiet, setQuiet] = useState<QuietHours>(prefs.quietHours);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'warning' } | null>(
    null,
  );
  const teamsActive = prefs.teamsAvailable && prefs.teamsLinked;

  const run = async (key: string, work: () => Promise<NotificationPrefs>) => {
    setBusy(key);
    setMessage(null);
    try {
      const next = await work();
      client.setQueryData(notificationPrefsQueryOptions(accessToken).queryKey, next);
      setMessage({ text: text.saved, tone: 'success' });
    } catch {
      setMessage({ text: text.saveFailed, tone: 'warning' });
    } finally {
      setBusy(null);
    }
  };

  const setMode = (kind: NotificationKind, channel: 'teams' | 'mail', mode: NotificationMode) =>
    setModes((current) => ({ ...current, [kind]: { ...current[kind], [channel]: mode } }));

  const modeSelect = (kind: NotificationKind, channel: 'teams' | 'mail') => (
    <div className="flex min-w-0 flex-1 basis-44 flex-col gap-1 text-sm">
      <label htmlFor={`${id}-${kind}-${channel}`} className="font-semibold text-muted-strong">
        {channel === 'teams' ? text.channelTeams : text.channelMail}
      </label>
      <NativeSelect
        id={`${id}-${kind}-${channel}`}
        value={modes[kind][channel]}
        disabled={channel === 'teams' && !teamsActive}
        onChange={(event) => setMode(kind, channel, event.target.value as NotificationMode)}
      >
        {(['now', 'digest', 'off'] as const).map((mode) => (
          <option key={mode} value={mode}>
            {text.modes[mode]}
          </option>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void run('save', () => saveNotificationPrefs(accessToken, { modes, quietHours: quiet }));
      }}
    >
      {message && <StatusLine message={message.text} tone={message.tone} />}

      <SettingsGroup title={text.teamsTitle}>
        <SettingsRow
          label={text.teamsTitle}
          description={
            !prefs.teamsAvailable
              ? text.teamsUnavailable
              : prefs.teamsLinked
                ? text.teamsLinked
                : text.teamsNotLinked
          }
        >
          {prefs.teamsAvailable && (
            <Button
              type="button"
              variant="secondary"
              loading={busy === 'teams'}
              onClick={() =>
                void run('teams', () =>
                  prefs.teamsLinked ? unlinkTeams(accessToken) : linkTeams(accessToken),
                )
              }
            >
              {prefs.teamsLinked ? text.teamsUnlink : text.teamsLink}
            </Button>
          )}
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title={text.kindsTitle}>
        {!teamsActive && (
          <p className="px-5 pt-4 text-muted-foreground text-sm">{text.kindsHint}</p>
        )}
        {notificationKinds.map((kind) => (
          <SettingsRow
            key={kind}
            label={text.kinds[kind]}
            {...(kind === 'digest' ? { description: text.digestMailHint } : {})}
            wide
          >
            <div className="flex w-full flex-wrap gap-3 sm:w-96">
              {modeSelect(kind, 'teams')}
              {modeSelect(kind, 'mail')}
            </div>
          </SettingsRow>
        ))}
      </SettingsGroup>

      <SettingsGroup title={text.quietTitle}>
        <SettingsRow label={text.quietTitle} description={text.quietHint} wide>
          <div className="flex w-full flex-col gap-3 sm:w-80">
            <div className="flex flex-wrap gap-3">
              {(['from', 'to'] as const).map((key) => (
                <div key={key} className="flex min-w-0 flex-1 basis-28 flex-col gap-1 text-sm">
                  <label htmlFor={`${id}-quiet-${key}`} className="font-semibold text-muted-strong">
                    {key === 'from' ? text.quietFrom : text.quietTo}
                  </label>
                  <Input
                    id={`${id}-quiet-${key}`}
                    type="time"
                    value={quiet[key]}
                    onChange={(event) => setQuiet({ ...quiet, [key]: event.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="flex min-h-11 items-center gap-3 text-sm">
              <Checkbox
                id={`${id}-weekend`}
                checked={quiet.weekend}
                onCheckedChange={(checked) => setQuiet({ ...quiet, weekend: checked === true })}
              />
              <label htmlFor={`${id}-weekend`}>{text.quietWeekend}</label>
            </div>
          </div>
        </SettingsRow>
      </SettingsGroup>

      <FormActions>
        <Button type="submit" loading={busy === 'save'}>
          {text.save}
        </Button>
      </FormActions>

      <section
        aria-labelledby={`${id}-rules`}
        className="flex flex-col gap-2 rounded-lg bg-card p-5 shadow-card"
      >
        <h2 id={`${id}-rules`} className="font-semibold text-base">
          {text.rulesTitle}
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-muted-strong text-sm">
          {text.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      {prefs.canManageOrganization && (
        <SettingsGroup title={text.orgTitle}>
          <SettingsRow label={text.orgTeams} description={text.orgTeamsHint}>
            <Switch
              aria-label={text.orgTeams}
              checked={prefs.teamsAvailable}
              disabled={busy !== null}
              onCheckedChange={(checked) =>
                void run('org', () =>
                  saveNotificationOrganization(accessToken, { teamsApp: checked }),
                )
              }
            />
          </SettingsRow>
          <SettingsRow label={text.orgMail}>
            <Switch
              aria-label={text.orgMail}
              checked={prefs.mailEnabled}
              disabled={busy !== null}
              onCheckedChange={(checked) =>
                void run('org', () => saveNotificationOrganization(accessToken, { mail: checked }))
              }
            />
          </SettingsRow>
        </SettingsGroup>
      )}

      <SettingsGroup title={text.recentTitle}>
        {prefs.recent.length === 0 ? (
          <p className="px-5 py-4 text-muted-foreground text-sm">{text.recentEmpty}</p>
        ) : (
          prefs.recent.map((entry) => (
            <SettingsRow
              key={entry.id}
              label={entry.title}
              description={`${text.kinds[entry.kind]} · ${format.dateTime(entry.createdAt)}`}
            >
              <span className="flex flex-wrap gap-2 sm:justify-end">
                <Badge variant="neutral">
                  {entry.channel === 'teams' ? text.channelTeams : text.channelMail}
                </Badge>
                <Badge
                  variant={
                    entry.status === 'failed'
                      ? 'danger'
                      : entry.status === 'sent'
                        ? 'success'
                        : 'neutral'
                  }
                >
                  {text.statuses[entry.status]}
                </Badge>
              </span>
            </SettingsRow>
          ))
        )}
      </SettingsGroup>
    </form>
  );
}
