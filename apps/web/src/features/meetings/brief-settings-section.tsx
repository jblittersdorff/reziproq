import { type MeetingType, meetingTypes } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { SettingsGroup } from '@/components/ui/settings-group';
import { StatusLine } from '@/components/ui/status-line';
import { useCan } from '@/features/auth/use-permissions';
import { briefSettingsQueryOptions, saveBriefSettings } from '@/lib/api';
import { useT } from '@/lib/i18n';

/**
 * Einstellungen KI › Termin-Briefing (KI-07): Vorlauf je Termintyp in Tagen. Leer heißt nur auf
 * Wunsch, 0 heißt gleich beim Anlegen. Nur Admins.
 */
export function BriefSettingsSection() {
  const t = useT();
  const text = t.meetings.brief;
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const canEdit = useCan('einstellungen.verwalten');
  const client = useQueryClient();
  const options = briefSettingsQueryOptions(accessToken);
  const query = useQuery({ ...options, enabled: accessToken !== '' && canEdit });
  const [draft, setDraft] = useState<Partial<Record<MeetingType, string>> | null>(null);
  const [saved, setSaved] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!canEdit) return null;
  const current =
    draft ??
    (query.data
      ? Object.fromEntries(
          meetingTypes.map((type) => [type, String(query.data.leadDays[type] ?? '')]),
        )
      : null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!current) return;
    setBusy(true);
    setSaved(false);
    setFailed(false);
    try {
      const leadDays = Object.fromEntries(
        meetingTypes.map((type) => {
          const value = (current[type] ?? '').trim();
          return [type, value === '' ? null : Math.min(60, Math.max(0, Math.round(Number(value))))];
        }),
      );
      client.setQueryData(options.queryKey, await saveBriefSettings(accessToken, { leadDays }));
      setDraft(null);
      setSaved(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      id="termin-briefing"
      aria-labelledby="ki-termin-briefing"
      className="flex scroll-mt-32 flex-col gap-3"
    >
      <h2
        id="ki-termin-briefing"
        className="font-display font-semibold text-section tracking-section"
      >
        {text.settingsTitle}
      </h2>
      <p className="text-muted-foreground text-sm">{text.settingsPurpose}</p>
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !current ? (
        <LoadingState label={text.loading} />
      ) : (
        <form className="flex flex-col gap-4" onSubmit={submit}>
          {saved && <StatusLine message={text.settingsSaved} onHidden={() => setSaved(false)} />}
          {failed && <StatusLine message={text.failed} tone="warning" />}
          <SettingsGroup>
            <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
              {meetingTypes.map((type) => (
                <FormField key={type} label={text.leadDays(t.meetings.types[type])}>
                  {(field) => (
                    <Input
                      {...field}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={60}
                      value={current[type] ?? ''}
                      onChange={(event) => setDraft({ ...current, [type]: event.target.value })}
                    />
                  )}
                </FormField>
              ))}
            </div>
          </SettingsGroup>
          <Button type="submit" variant="secondary" className="self-start" loading={busy}>
            {text.saveSettings}
          </Button>
        </form>
      )}
    </section>
  );
}
