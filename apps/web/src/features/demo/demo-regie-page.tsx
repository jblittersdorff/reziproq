import {
  type AiMode,
  type DemoRegie,
  type DemoTimeRequest,
  demoRoles,
  demoStations,
} from '@reziproq/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { ErrorState } from '@/components/ui/error-state';
import { ListRow, ListRowText } from '@/components/ui/list-card';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { PageTitle } from '@/components/ui/page-title';
import { SectionCard } from '@/components/ui/section-card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatusLine } from '@/components/ui/status-line';
import { useDocumentTitle } from '@/features/shell/page-header';
import { shortDate } from '@/features/start/next-action';
import {
  ApiError,
  advanceDemoClock,
  demoRegieQueryOptions,
  playDemoSignal,
  resetDemo,
  setDemoMode,
} from '@/lib/api';
import { readDemoSession } from '@/lib/demo-session';
import { useLocale, useMessages } from '@/lib/i18n';
import { demoRegieMessages, demoScenarioKeys, demoScenarioPackage } from './demo-regie-messages';

const berlinDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' });

/** Demo-Uhr in Berlin, z. B. „Mo 23.11., 07:30“ (Vorlage Demo-Regie) */
function clockText(locale: string, iso: string) {
  const at = new Date(iso);
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin',
  }).format(at);
  return `${shortDate(locale, berlinDay.format(at))}, ${time}`;
}

type Status = { message: string; tone: 'success' | 'warning' };

/**
 * Demo-Regie (DM-01, K1-g.4, Vorlage Demo-Regie): Szenario, Signale, Zeit, Rolle, Gegenüber,
 * Antworten der KI und Zurücksetzen. Nur im Demo-Mandanten; ⌥D öffnet sie in einer Demo-Sitzung von
 * jeder Seite. Was erst mit späteren Paketen kommt, steht als Text „folgt mit …“ da, nicht als Knopf.
 *
 * Bewusste Abweichungen von der Vorlage: „Auf Datum springen“ braucht ein Ziel, und Pop-ups gibt es
 * nicht (Designsprache, Regel 6); deshalb steht davor eine Auswahl der Stationen aus DM-01. Unter
 * „Gegenüber“ steht nur „Ein Fenster“ als Marke, bis K5 die Wahl mit Simulator baut (SI-01).
 */
export function DemoRegiePage() {
  const text = useMessages(demoRegieMessages);
  useDocumentTitle(text.title);
  const { locale } = useLocale();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const client = useQueryClient();
  const query = useQuery({ ...demoRegieQueryOptions(accessToken), enabled: accessToken !== '' });
  const [status, setStatus] = useState<Status | null>(null);
  const [station, setStation] = useState<string>(demoStations[0]);
  const header = <PageTitle title={text.title} where={text.where} />;

  // Nach jeder Aktion hat sich der Stand der Demo bewegt: alles neu laden (Heute, Seitenleiste). Nicht
  // darauf warten, sonst bliebe die Regie gesperrt, bis die letzte Abfrage samt Wiederholungen fertig ist.
  const refresh = (next?: DemoRegie) => {
    if (next) client.setQueryData(demoRegieQueryOptions(accessToken).queryKey, next);
    void client.invalidateQueries();
  };
  const time = useMutation({
    mutationFn: (request: DemoTimeRequest) => advanceDemoClock(accessToken, request),
    onSuccess: (next) => {
      setStatus({
        message: text.time.moved(clockText(locale, next.demoNow), next.runs.length),
        tone: 'success',
      });
      refresh(next);
    },
    onError: () => setStatus({ message: text.time.failed, tone: 'warning' }),
  });
  const signal = useMutation({
    mutationFn: () => playDemoSignal(accessToken, 'mail_kim_kaiser'),
    onSuccess: (result) => {
      const where =
        result.objectType === 'filed_mail'
          ? 'filed'
          : result.objectType === 'inbound_item'
            ? 'review'
            : 'other';
      setStatus({ message: text.signals.played(where), tone: 'success' });
      refresh();
    },
    onError: () => setStatus({ message: text.signals.failed, tone: 'warning' }),
  });
  const mode = useMutation({
    mutationFn: (next: AiMode) => setDemoMode(accessToken, next),
    onSuccess: (next) => refresh(next),
    onError: () => setStatus({ message: text.ai.failed, tone: 'warning' }),
  });
  const reset = useMutation({
    mutationFn: () => resetDemo(accessToken),
    onSuccess: (next) => {
      setStatus({ message: text.reset.done(clockText(locale, next.demoNow)), tone: 'success' });
      refresh(next);
    },
    onError: (error) =>
      setStatus({
        message:
          error instanceof ApiError && error.status === 409
            ? text.reset.missing
            : text.reset.failed,
        tone: 'warning',
      }),
  });

  if (query.isError) {
    // Außerhalb des Demo-Mandanten gibt es die Regie nicht (T1-DM2, die API antwortet mit 404)
    const notDemo = query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="flex flex-col gap-5.5">
        {header}
        <ErrorState
          title={notDemo ? text.notDemo : text.failed}
          action={
            notDemo ? undefined : (
              <Button variant="secondary" onClick={() => query.refetch()}>
                {text.retry}
              </Button>
            )
          }
        />
      </div>
    );
  }
  if (!query.data) {
    return (
      <div className="flex flex-col gap-5.5">
        {header}
        <LoadingState label={text.loading} />
      </div>
    );
  }

  const data = query.data;
  const busy = time.isPending || signal.isPending || reset.isPending || mode.isPending;
  const me = readDemoSession()?.person.id ?? auth.user?.profile.sub;
  return (
    <div className="flex flex-col gap-5.5">
      {header}
      {status && (
        <StatusLine message={status.message} tone={status.tone} onHidden={() => setStatus(null)} />
      )}
      <div className="grid gap-5.5 wide:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5.5">
          <SectionCard label={text.scenario.label}>
            <ul className="overflow-hidden rounded-md shadow-inset-line">
              {demoScenarioKeys.map((key) => {
                const later = demoScenarioPackage[key];
                const item = text.scenario.items[key];
                return (
                  <li key={key}>
                    <ListRow>
                      <ListRowText title={item.title} detail={item.detail} />
                      <Badge variant={later ? 'neutral' : 'success'}>
                        {later ? text.scenario.follows(later) : text.scenario.ready}
                      </Badge>
                    </ListRow>
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          <SectionCard label={text.signals.label}>
            <div className="flex flex-wrap gap-2.5">
              <Button variant="secondary" disabled={busy} onClick={() => signal.mutate()}>
                {text.signals.mailKimKaiser}
              </Button>
            </div>
            <p className="text-detail text-muted-foreground">{text.signals.more}</p>
            <p className="text-detail text-muted-foreground">{text.signals.note}</p>
          </SectionCard>

          <SectionCard label={text.time.label}>
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-display font-semibold text-section tabular-nums tracking-section">
                <span className="sr-only">{`${text.time.clock}: `}</span>
                <time dateTime={data.demoNow}>{clockText(locale, data.demoNow)}</time>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => time.mutate({ aktion: 'neuer_tag' })}
                >
                  {text.time.newDay}
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => time.mutate({ aktion: 'stunde' })}
                >
                  {text.time.hour}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Die Hülle gibt die Breite vor (wie die Sortierung der Lieferanten), das Feld ist eine Pille */}
              <div className="w-48">
                <NativeSelect
                  aria-label={text.time.station}
                  className="rounded-full pl-4"
                  value={station}
                  onChange={(event) => setStation(event.target.value)}
                >
                  {demoStations.map((date) => (
                    <option key={date} value={date}>
                      {`${shortDate(locale, date)}${date.startsWith('2027') ? ` ${date.slice(0, 4)}` : ''}`}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => time.mutate({ aktion: 'datum', datum: station })}
              >
                {text.time.jump}
              </Button>
            </div>
            <p className="text-detail text-muted-foreground">{text.time.later}</p>
          </SectionCard>
        </div>

        <aside className="flex min-w-0 flex-col gap-5.5">
          <SectionCard label={text.role.label}>
            <div className="flex flex-wrap gap-2.5">
              {demoRoles.map((role) => (
                <Button key={role.id} asChild variant={role.id === me ? 'default' : 'secondary'}>
                  <a
                    href={`/demo/als/${role.id}`}
                    aria-current={role.id === me ? 'true' : undefined}
                  >
                    {text.role[role.key]}
                  </a>
                </Button>
              ))}
            </div>
            <p className="text-detail text-muted-foreground">{text.role.note}</p>
          </SectionCard>

          <SectionCard label={text.counterpart.label}>
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge variant="ink">{text.counterpart.one}</Badge>
            </div>
            <p className="text-detail text-muted-foreground">{text.counterpart.later}</p>
          </SectionCard>

          <SectionCard label={text.ai.label}>
            <SegmentedControl<AiMode>
              label={text.ai.label}
              value={mode.isPending && mode.variables ? mode.variables : data.mode}
              disabled={busy}
              onChange={(next) => mode.mutate(next)}
              options={(['record', 'replay', 'live'] as const).map((value) => ({
                value,
                label: text.ai.modes[value],
              }))}
            />
            <p className="text-detail text-muted-foreground">{text.ai.note}</p>
          </SectionCard>

          <SectionCard label={text.reset.label}>
            <p className="text-detail text-muted-foreground">{text.reset.text}</p>
            <div>
              <ConfirmButton
                question={text.reset.question}
                confirmLabel={text.reset.confirm}
                cancelLabel={text.reset.cancel}
                onConfirm={() => reset.mutate()}
              >
                {text.reset.action}
              </ConfirmButton>
            </div>
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
