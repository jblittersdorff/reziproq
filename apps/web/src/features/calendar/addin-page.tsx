import { type AddinDetect, type MeetingType, meetingTypes } from '@reziproq/shared';
import { useEffect, useId, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Logo } from '@/components/ui/brand-mark';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import { Switch } from '@/components/ui/switch';
import { RequireLogin } from '@/features/auth/require-login';
import { useMe } from '@/features/auth/use-me';
import { detectAddin, registerAddin } from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';
import { type OutlookAdapter, type OutlookItem, outlookAdapter } from './outlook-adapter';

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
  const [item, setItem] = useState<OutlookItem | null | undefined>(undefined);
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
      if (!read) return;
      const found = await detectAddin(accessToken, read.attendees, read.subject).catch(() => null);
      setDetected(found);
      if (found) {
        setType(found.suggestedType);
        setSupplier(found.supplier?.relationshipId ?? found.candidates[0]?.relationshipId ?? '');
      }
    })();
  }, [adapter, accessToken]);

  const save = async () => {
    if (!adapter || !item || !supplier) return;
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
              value={supplier} onChange={(event) => setSupplier(event.target.value)}>
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
              value={type} onChange={(event) => setType(event.target.value as MeetingType)}>
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
