import type { TranscriptSettings } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useId, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  confirmWorksAgreement,
  saveTranscriptSettings,
  transcriptSettingsQueryOptions,
} from '@/lib/api';
import { appNow } from '@/lib/clock';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';

/**
 * IN-05 Einstellungen › Anbindungen, rechts „Transkripte“ (nach Regeln): Betriebsvereinbarung
 * bestätigen (mit Vorlage), dann einschalten; Zustimmung je Termin immer an; Aufbewahrung, Weg für
 * Teams, Hinweis in der Einladung. Nur für Admins.
 */
export function TranscriptSettingsSection() {
  const text = useT().transcripts;
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({
    ...transcriptSettingsQueryOptions(accessToken),
    enabled: accessToken !== '',
  });
  if (query.isError) return null;
  return (
    <section
      aria-labelledby="anbindungen-transkripte"
      className="flex flex-col gap-4 rounded-lg bg-card p-6 shadow-card"
    >
      <h2
        id="anbindungen-transkripte"
        className="font-display font-semibold text-section tracking-section"
      >
        {text.settingsTitle}
      </h2>
      {!query.data ? (
        <LoadingState label={text.settingsLoading} />
      ) : (
        <TranscriptSettingsForm settings={query.data} accessToken={accessToken} />
      )}
    </section>
  );
}

function TranscriptSettingsForm({
  settings,
  accessToken,
}: {
  settings: TranscriptSettings;
  accessToken: string;
}) {
  const text = useT().transcripts;
  const format = useFormat();
  const id = useId();
  const client = useQueryClient();
  const [date, setDate] = useState(appNow().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [retention, setRetention] = useState(settings.retentionDays);
  const [mode, setMode] = useState(settings.teamsMode);
  const [notice, setNotice] = useState(settings.inviteNotice);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'warning' } | null>(
    null,
  );
  const run = async (key: string, work: () => Promise<TranscriptSettings>) => {
    setBusy(key);
    setMessage(null);
    try {
      client.setQueryData(transcriptSettingsQueryOptions(accessToken).queryKey, await work());
      setMessage({ text: text.saved, tone: 'success' });
    } catch (error) {
      const code = (error as { body?: { code?: string } }).body?.code;
      setMessage({ text: (code && text.errors[code]) || text.failed, tone: 'warning' });
    } finally {
      setBusy(null);
    }
  };
  const disabled = !settings.canManage || busy !== null;

  return (
    <div className="flex flex-col gap-5 text-sm">
      {message && <StatusLine message={message.text} tone={message.tone} />}
      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">{text.agreementTitle}</h3>
        <p className="text-muted-foreground">
          {settings.worksAgreement
            ? text.agreementConfirmed(
                format.date(settings.worksAgreement.confirmedAt),
                settings.worksAgreement.confirmedBy,
              )
            : text.agreementMissing}
        </p>
        {settings.canManage && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              void run('agreement', () => confirmWorksAgreement(accessToken, date, file));
            }}
          >
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-date`} className="font-semibold text-muted-strong">
                {text.agreementDate}
              </label>
              <Input
                id={`${id}-date`}
                type="date"
                value={date}
                required
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-muted-strong">{text.agreementFile}</span>
              <label className="relative inline-flex self-start">
                <input
                  id={`${id}-file`}
                  type="file"
                  className="peer sr-only"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                <span className="inline-flex h-11 cursor-pointer items-center rounded-full bg-card px-5 font-semibold shadow-inset-line peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
                  {file ? file.name : text.agreementChoose}
                </span>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="secondary" loading={busy === 'agreement'}>
                {text.agreementConfirm}
              </Button>
              <a
                href="/vorlagen/betriebsvereinbarung-transkripte.txt"
                download
                className="min-h-11 py-3 font-semibold text-petrol underline"
              >
                {text.agreementTemplate}
              </a>
            </div>
          </form>
        )}
      </div>

      <div className="flex items-start gap-3 border-line-soft border-t pt-4">
        <Switch
          id={`${id}-enabled`}
          checked={settings.enabled}
          disabled={disabled || !settings.worksAgreement}
          onCheckedChange={(checked) =>
            void run('enabled', () => saveTranscriptSettings(accessToken, { enabled: checked }))
          }
        />
        <span className="flex flex-col gap-0.5">
          <label htmlFor={`${id}-enabled`} className="font-semibold">
            {text.enabled}
          </label>
          <span className="text-muted-foreground">{text.enabledHint}</span>
        </span>
      </div>
      <div className="flex items-start gap-3">
        <Switch id={`${id}-per-meeting`} checked disabled />
        <span className="flex flex-col gap-0.5">
          <label htmlFor={`${id}-per-meeting`} className="font-semibold">
            {text.perMeeting}
          </label>
          <span className="text-muted-foreground">{text.perMeetingHint}</span>
        </span>
      </div>

      <form
        className="flex flex-col gap-3 border-line-soft border-t pt-4"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          void run('save', () =>
            saveTranscriptSettings(accessToken, {
              retentionDays: retention,
              teamsMode: mode,
              inviteNotice: notice,
            }),
          );
        }}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-retention`} className="font-semibold text-muted-strong">
            {text.retention}
          </label>
          <NativeSelect
            id={`${id}-retention`}
            value={retention}
            disabled={disabled}
            onChange={(event) => setRetention(Number(event.target.value) as 30 | 90 | 180)}
          >
            {([30, 90, 180] as const).map((days) => (
              <option key={days} value={days}>
                {text.retentionDays(days)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-mode`} className="font-semibold text-muted-strong">
            {text.teamsMode}
          </label>
          <NativeSelect
            id={`${id}-mode`}
            value={mode}
            disabled={disabled}
            onChange={(event) => setMode(event.target.value as 'meeting' | 'org')}
          >
            <option value="meeting">{text.teamsModes.meeting}</option>
            <option value="org">{text.teamsModes.org}</option>
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-notice`} className="font-semibold text-muted-strong">
            {text.inviteNotice}
          </label>
          <Textarea
            id={`${id}-notice`}
            rows={3}
            maxLength={500}
            value={notice}
            disabled={disabled}
            onChange={(event) => setNotice(event.target.value)}
          />
        </div>
        {settings.canManage && (
          <Button type="submit" className="self-start" loading={busy === 'save'}>
            {text.save}
          </Button>
        )}
      </form>
      <p className="text-muted-foreground">{text.neverMedia}</p>
    </div>
  );
}
