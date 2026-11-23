import {
  type AddinDetect,
  type FiledMailVisibility,
  type FileMailResult,
  type MeetingType,
  meetingTypes,
} from '@reziproq/shared';
import { useEffect, useId, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Logo } from '@/components/ui/brand-mark';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatusLine } from '@/components/ui/status-line';
import { Switch } from '@/components/ui/switch';
import { RequireLogin } from '@/features/auth/require-login';
import { useMe } from '@/features/auth/use-me';
import { detectAddin, detectMail, fileMail, registerAddin } from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';
import {
  type OutlookAdapter,
  type OutlookItem,
  type OutlookMessage,
  outlookAdapter,
} from './outlook-adapter';

/**
 * IN-03 Outlook-Add-in, Aufgabenbereich (nach O-Outlook.dc.html): erkannter Lieferant, Termintyp,
 * Schalter für Briefing, Transkript und Agenda, „Als Aktivität speichern“. Schmal wie ein
 * Aufgabenbereich in Outlook; die Anmeldung läuft über das Firmenkonto (IN-02).
 */
export function AddinPage({ adapter }: { adapter?: OutlookAdapter }) {
  return (
    <RequireLogin>
      <AddinPane adapter={adapter} />
    </RequireLogin>
  );
}

function AddinPane({ adapter: given }: { adapter?: OutlookAdapter | undefined }) {
  const t = useT();
  const text = t.addin;
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const id = useId();
  const [adapter, setAdapter] = useState<OutlookAdapter | null>(given ?? null);
  const [item, setItem] = useState<OutlookItem | OutlookMessage | null | undefined>(undefined);
  const [detected, setDetected] = useState<AddinDetect | null>(null);
  const [supplier, setSupplier] = useState('');
  const [type, setType] = useState<MeetingType>('other');
  const [brief, setBrief] = useState(true);
  const [transcript, setTranscript] = useState(false);
  const [agenda, setAgenda] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'warning' } | null>(
    null,
  );

  // Ohne Rahmen der App: die gespeicherte Sprache selbst übernehmen (PLT-09)
  const me = useMe();
  const { setLocale } = useLocale();
  const saved = me.data?.locale;
  useEffect(() => {
    if (saved) setLocale(saved);
  }, [saved, setLocale]);
  useEffect(() => {
    if (given) return;
    void outlookAdapter().then(setAdapter);
  }, [given]);
  useEffect(() => {
    if (!adapter || !accessToken) return;
    void (async () => {
      const read = await adapter.read().catch(() => null);
      setItem(read);
      // IN-04: Eine gelesene Mail erkennt der Mail-Bereich selbst
      if (!read || read.mode === 'message') return;
      const found = await detectAddin(accessToken, read.attendees, read.subject).catch(() => null);
      setDetected(found);
      if (found) {
        setType(found.suggestedType);
        setSupplier(found.supplier?.relationshipId ?? found.candidates[0]?.relationshipId ?? '');
      }
    })();
  }, [adapter, accessToken]);

  const save = async () => {
    if (!adapter || !item || item.mode === 'message' || !supplier) return;
    setBusy(true);
    setMessage(null);
    try {
      const registered = await registerAddin(accessToken, {
        organizerEmail: item.organizerEmail || auth.user?.profile.email || '',
        subject: item.subject || '–',
        startAt: item.startAt,
        relationshipId: supplier,
        type,
        briefOptIn: brief,
        transcriptOptIn: transcript,
        insertAgenda: agenda,
      });
      if (registered.transcriptNotice) await adapter.prependBody(registered.transcriptNotice);
      if (registered.inboundAddress) await adapter.addAttendeeAndSave(registered.inboundAddress);
      setMessage({ text: text.saved, tone: 'success' });
    } catch {
      setMessage({ text: text.failed, tone: 'warning' });
    } finally {
      setBusy(false);
    }
  };

  const candidates = detected?.candidates ?? [];
  const switches = [
    { key: 'brief', label: text.brief, value: brief, set: setBrief },
    { key: 'transcript', label: text.transcript, value: transcript, set: setTranscript },
    { key: 'agenda', label: text.insertAgenda, value: agenda, set: setAgenda },
  ];
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-4">
      <h1>
        <Logo name={text.title} />
      </h1>
      {adapter?.preview && <p className="text-muted-foreground text-chip">{text.preview}</p>}
      {item === undefined ? (
        <LoadingState label={text.loading} />
      ) : item === null ? (
        <p className="text-muted-foreground text-sm">{text.noItem}</p>
      ) : item.mode === 'message' ? (
        <MailPane message={item} accessToken={accessToken} />
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <strong className="font-semibold">{item.subject || '–'}</strong>
            <span className="text-muted-foreground text-sm">
              {detected?.supplier ? text.detected : text.noneDetected}
            </span>
            {detected?.reason && (
              <span className="text-muted-foreground text-chip">{detected.reason}</span>
            )}
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor={`${id}-lieferant`} className="font-semibold">
              {text.supplierLabel}
            </label>
            <NativeSelect
              id={`${id}-lieferant`}
              value={supplier}
              onChange={(event) => setSupplier(event.target.value)}
            >
              {candidates.length === 0 && <option value="">–</option>}
              {candidates.map((entry) => (
                <option key={entry.relationshipId} value={entry.relationshipId}>
                  {entry.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <label htmlFor={`${id}-typ`} className="font-semibold">
              {text.typeLabel}
            </label>
            <NativeSelect
              id={`${id}-typ`}
              value={type}
              onChange={(event) => setType(event.target.value as MeetingType)}
            >
              {meetingTypes
                .filter((entry) => entry !== 'format')
                .map((entry) => (
                  <option key={entry} value={entry}>
                    {t.meetings.types[entry]}
                  </option>
                ))}
            </NativeSelect>
          </div>
          {switches.map((entry) => (
            <div key={entry.key} className="flex items-center gap-3">
              <Switch
                id={`${id}-${entry.key}`}
                checked={entry.value}
                onCheckedChange={(checked) => entry.set(checked)}
              />
              <label htmlFor={`${id}-${entry.key}`} className="text-sm">
                {entry.label}
              </label>
            </div>
          ))}
          {message && <StatusLine message={message.text} tone={message.tone} />}
          <Button loading={busy} disabled={!supplier} onClick={() => void save()}>
            {text.save}
          </Button>
        </>
      )}
    </main>
  );
}

/**
 * IN-04: In einer gelesenen Mail: erkannter Lieferant, Sichtbarkeit, „In Reziproq ablegen“. Erst
 * der Klick lässt die API genau diese Mail über Microsoft Graph lesen.
 */
function MailPane({ message, accessToken }: { message: OutlookMessage; accessToken: string }) {
  const text = useT().addin;
  const id = useId();
  const [detected, setDetected] = useState<AddinDetect | null | undefined>(undefined);
  const [supplier, setSupplier] = useState('');
  const [visibility, setVisibility] = useState<FiledMailVisibility>('team');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FileMailResult | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    void detectMail(accessToken, { from: message.from, to: message.to, cc: message.cc })
      .catch(() => null)
      .then((found) => {
        setDetected(found);
        setSupplier(found?.supplier?.relationshipId ?? found?.candidates[0]?.relationshipId ?? '');
      });
  }, [accessToken, message]);

  const file = async () => {
    setBusy(true);
    setFailed(null);
    try {
      setResult(
        await fileMail(accessToken, {
          itemId: message.itemId,
          relationshipId: supplier,
          visibility,
        }),
      );
    } catch (error) {
      const status = (error as { status?: number }).status;
      setFailed(status === 409 ? text.mailNoConnection : text.failed);
    } finally {
      setBusy(false);
    }
  };

  if (detected === undefined) return <LoadingState label={text.mailLoading} />;
  const candidates = detected?.candidates ?? [];
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-chip">{text.mailFrom(message.from)}</span>
        <strong className="break-words font-semibold">{message.subject || '–'}</strong>
        <span className="text-muted-foreground text-sm">
          {detected?.supplier ? text.detected : text.noneDetected}
        </span>
        {detected?.reason && (
          <span className="text-muted-foreground text-chip">{detected.reason}</span>
        )}
      </div>
      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor={`${id}-lieferant`} className="font-semibold">
          {text.supplierLabel}
        </label>
        <NativeSelect
          id={`${id}-lieferant`}
          value={supplier}
          onChange={(event) => setSupplier(event.target.value)}
        >
          {candidates.length === 0 && <option value="">–</option>}
          {candidates.map((entry) => (
            <option key={entry.relationshipId} value={entry.relationshipId}>
              {entry.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <SegmentedControl<FiledMailVisibility>
        label={text.mailVisibility}
        value={visibility}
        options={[
          { value: 'team', label: text.mailVisibilities.team },
          { value: 'private', label: text.mailVisibilities.private },
        ]}
        onChange={setVisibility}
      />
      {result && (
        <StatusLine
          message={result.created ? text.mailFiled : text.mailAlready}
          tone={result.created ? 'success' : 'warning'}
        />
      )}
      {result && (
        <a
          href={result.href}
          target="_blank"
          rel="noreferrer"
          className="min-h-11 py-2 font-semibold text-petrol text-sm underline"
        >
          {text.mailOpen}
        </a>
      )}
      {failed && <StatusLine message={failed} tone="warning" />}
      <Button loading={busy} disabled={!supplier || Boolean(result)} onClick={() => void file()}>
        {text.mailSave}
      </Button>
      <p className="text-muted-foreground text-chip">{text.mailOnlyThis}</p>
    </>
  );
}
