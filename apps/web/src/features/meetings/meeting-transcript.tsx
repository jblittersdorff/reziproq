import type { MeetingTranscriptState, TranscriptText } from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LockIcon } from 'lucide-react';
import { type ChangeEvent, useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { Switch } from '@/components/ui/switch';
import { useToken } from '@/features/ratings/use-rating';
import {
  meetingTranscriptQueryOptions,
  releaseTranscript,
  setTranscriptOptIn,
  transcriptTextQueryOptions,
  uploadTranscript,
} from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';

/**
 * IN-05 Transkript eines Termins (nur Käuferseite, nach Regeln): Schalter „Transkript übernehmen“,
 * Stand des Abrufs mit Dauer, Sprechern und Löschdatum, Grund ohne Transkript mit Upload und
 * Notizen, Rohtext mit markierten Fundstellen. Privat: grau gestrichelt mit Schloss.
 */
export function MeetingTranscriptPanel({
  relationshipId,
  meetingId,
  compact = false,
  onCaptureNotes,
}: {
  relationshipId: string;
  meetingId: string;
  /** Reiter Vorbereitung: nur der Schalter */
  compact?: boolean;
  onCaptureNotes?: () => void;
}) {
  const text = useT().transcripts;
  const format = useFormat();
  const accessToken = useToken();
  const client = useQueryClient();
  const id = useId();
  const options = meetingTranscriptQueryOptions(accessToken, relationshipId, meetingId);
  const query = useQuery({ ...options, enabled: accessToken !== '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'warning' } | null>(
    null,
  );
  const [showText, setShowText] = useState(false);
  if (query.isError) return null;
  if (!query.data) return <LoadingState label={text.loading} />;
  const state = query.data;

  const run = async (key: string, work: () => Promise<MeetingTranscriptState>) => {
    setBusy(key);
    setMessage(null);
    try {
      client.setQueryData(options.queryKey, await work());
      await client.invalidateQueries({ queryKey: ['termine', meetingId], exact: false });
      setMessage({ text: text.saved, tone: 'success' });
    } catch (error) {
      const code = (error as { body?: { code?: string } }).body?.code;
      setMessage({ text: (code && text.errors[code]) || text.failed, tone: 'warning' });
    } finally {
      setBusy(null);
    }
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!/\.(vtt|docx|txt)$/i.test(file.name)) {
      setMessage({ text: text.errors.format_nicht_unterstuetzt ?? text.failed, tone: 'warning' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ text: text.errors.datei_zu_gross ?? text.failed, tone: 'warning' });
      return;
    }
    void run('upload', () => uploadTranscript(accessToken, relationshipId, meetingId, file));
  };

  const transcript = state.transcript;
  const optInRow = (
    <div className="flex items-start gap-3">
      <Switch
        id={`${id}-opt-in`}
        checked={state.optIn}
        disabled={!state.canManage || !state.orgEnabled || busy !== null}
        onCheckedChange={(checked) =>
          void run('opt-in', () =>
            setTranscriptOptIn(accessToken, relationshipId, meetingId, checked),
          )
        }
      />
      <span className="flex flex-col gap-0.5">
        <label htmlFor={`${id}-opt-in`} className="font-semibold text-sm">
          {text.optIn}
        </label>
        <span className="text-muted-foreground text-sm">
          {state.orgEnabled ? text.optInHint : text.orgOff}
        </span>
      </span>
    </div>
  );

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="flex flex-col gap-4 rounded-lg border-2 border-line border-dashed bg-card p-5"
    >
      <h2 id={`${id}-title`} className="flex items-center gap-2 font-semibold text-base">
        <LockIcon aria-hidden className="size-4 text-muted-foreground" />
        {text.title}
      </h2>
      {optInRow}
      {message && <StatusLine message={message.text} tone={message.tone} />}
      {!compact && (
        <>
          {!transcript ? (
            <p className="text-muted-foreground text-sm">{text.none}</p>
          ) : transcript.status === 'pending' ? (
            <Badge variant="neutral">{text.pending}</Badge>
          ) : transcript.status === 'fetched' ? (
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">
                {text.fetched(text.sources[transcript.source] ?? '')}
              </span>
              <span className="text-muted-foreground">
                {[
                  transcript.durationS !== null
                    ? text.duration(Math.max(1, Math.round(transcript.durationS / 60)))
                    : null,
                  text.speakers(transcript.speakers.length),
                  transcript.deleteAfter
                    ? text.deleteOn(format.date(transcript.deleteAfter))
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              {transcript.speakers.length > 0 && (
                <span className="text-muted-foreground">
                  {transcript.speakers.map((speaker) => speaker.name).join(', ')}
                </span>
              )}
            </div>
          ) : transcript.status === 'deleted' ? (
            <p className="text-muted-foreground text-sm">{text.deleted}</p>
          ) : (
            <p className="text-sm">{transcript.unavailableReason}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {state.canUpload && (
              <label className="relative inline-flex">
                <input
                  type="file"
                  accept=".vtt,.docx,.txt"
                  className="peer sr-only"
                  aria-describedby={`${id}-upload-hint`}
                  onChange={onFile}
                  disabled={busy !== null}
                />
                <span className="inline-flex h-11 cursor-pointer items-center rounded-full bg-card px-5 font-semibold text-sm shadow-inset-line peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50">
                  {text.upload}
                </span>
              </label>
            )}
            {onCaptureNotes && transcript?.status !== 'fetched' && (
              <Button variant="ghost" onClick={onCaptureNotes}>
                {text.notes}
              </Button>
            )}
            {transcript?.status === 'fetched' && state.canRead && (
              <Button
                variant="ghost"
                aria-expanded={showText}
                onClick={() => setShowText(!showText)}
              >
                {showText ? text.hideText : text.showText}
              </Button>
            )}
            {transcript?.status === 'fetched' && state.canManage && (
              <Button
                variant="ghost"
                loading={busy === 'release'}
                onClick={() =>
                  void run('release', () =>
                    releaseTranscript(accessToken, relationshipId, meetingId, !transcript.released),
                  )
                }
              >
                {transcript.released ? text.released : text.release}
              </Button>
            )}
          </div>
          {state.canUpload && (
            <p id={`${id}-upload-hint`} className="text-muted-foreground text-chip">
              {text.uploadHint}
            </p>
          )}
          {showText && <TranscriptTextView relationshipId={relationshipId} meetingId={meetingId} />}
          <p className="text-muted-foreground text-chip">
            {text.privateNote} {text.neverMedia}
          </p>
        </>
      )}
    </section>
  );
}

function TranscriptTextView({
  relationshipId,
  meetingId,
}: {
  relationshipId: string;
  meetingId: string;
}) {
  const text = useT().transcripts;
  const accessToken = useToken();
  const query = useQuery({
    ...transcriptTextQueryOptions(accessToken, relationshipId, meetingId),
    enabled: accessToken !== '',
  });
  if (query.isError) return <p className="text-muted-foreground text-sm">{text.textFailed}</p>;
  if (!query.data) return <p className="text-muted-foreground text-sm">{text.textLoading}</p>;
  return <TranscriptLines data={query.data} quoteLabel={text.quoteMark} />;
}

const clock = (seconds: number) => {
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
};

/** Text mit Zeit und Sprecher; Sätze, die ein Entwurf zitiert, sind markiert */
export function TranscriptLines({
  data,
  quoteLabel,
}: {
  data: TranscriptText;
  quoteLabel: string;
}) {
  return (
    <ol className="flex max-h-96 flex-col gap-2 overflow-y-auto rounded-md bg-paper p-4 text-sm">
      {data.entries.map((entry, index) => {
        const quoted = data.quotes.some((quote) => quote && entry.text.includes(quote));
        return (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: feste Reihenfolge des Transkripts
            key={index}
            className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3"
          >
            <span className="text-muted-foreground tabular-nums">{clock(entry.at)}</span>
            <span className="min-w-0 break-words">
              {entry.speaker && <strong className="font-semibold">{entry.speaker}: </strong>}
              {quoted ? (
                <mark className="rounded-sm bg-mint-soft px-0.5 text-text" title={quoteLabel}>
                  {entry.text}
                  <span className="sr-only"> ({quoteLabel})</span>
                </mark>
              ) : (
                entry.text
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
