import type { DueItem, NextMeeting } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronRightIcon, UsersIcon } from 'lucide-react';
import { useAuth } from 'react-oidc-context';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { Stage, StageMetrics } from '@/components/ui/stage';
import { Tile } from '@/components/ui/tile';
import { useMe } from '@/features/auth/use-me';
import { PromptTrigger } from '@/features/prompt/prompt-trigger';
import { routerLink } from '@/features/shell/navigation';
import { useDocumentTitle } from '@/features/shell/page-header';
import { InStageSlot } from '@/features/shell/stage-slot';
import { startQueryOptions } from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { dayTime } from './greeting';

export const itemLinkClass =
  'flex min-h-11 flex-col justify-center rounded-md px-2 py-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

export function dueTitle(t: ReturnType<typeof useT>, item: DueItem) {
  if (item.kind === 'cycle') {
    const steps = t.workspace.cycle.steps;
    const step =
      item.detail && Object.hasOwn(steps, item.detail)
        ? steps[item.detail as keyof typeof steps]
        : (item.detail ?? '');
    return t.start.dueCycle(step);
  }
  if (item.kind === 'contribution') return t.start.dueContribution(item.detail);
  return t.start.dueRating(item.detail);
}

export function formatDate(locale: string, date: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(`${date}T00:00:00`),
  );
}

/**
 * Start nach dem Login (PLT-11, NAV-05, UMB-05): dunkle Bühne mit Datum, Begrüßung, einem Satz zur
 * Lage, einem Knopf zur nächsten Aufgabe und den Zahlen (PLT-10). Darunter nur, was Inhalt hat:
 * die fälligen Aufgaben als Liste mit einem Knopf je Zeile, die eigenen Lieferanten bzw. Kunden
 * als Karten, rechts der nächste Termin und das Fragefeld. Speichert nichts; jeder Eintrag führt
 * zum Ort der Sache, und was dort erledigt ist, verschwindet hier von selbst.
 */
export function StartPage() {
  const t = useT();
  const { locale } = useLocale();
  const me = useMe();
  // Lieferantenseite (LIF-02): Kunden statt Lieferanten, Fragen folgen mit QS-05.
  const supplierSide = Boolean(
    me.data?.permissions.viewCustomers && !me.data.permissions.viewBuyerAreas,
  );
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({ ...startQueryOptions(accessToken), enabled: accessToken !== '' });

  useDocumentTitle(t.start.title);

  const greeting = {
    morning: t.start.greetingMorning,
    day: t.start.greetingDay,
    evening: t.start.greetingEvening,
  }[dayTime(new Date())];
  const data = query.data;
  const today = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  const relationshipHref = (id: string) => (supplierSide ? `/kunden/${id}` : `/lieferanten/${id}`);
  const first = data?.due.items[0];

  return (
    <>
      <InStageSlot>
        <Stage
          eyebrow={today}
          title={me.data ? greeting(me.data.firstName) : t.start.greetingWithoutName}
          text={data && t.start.todayTitle(data.due.total)}
          actions={
            first &&
            routerLink({
              href: first.href,
              className: buttonVariants(),
              children: t.start.nextStep,
            })
          }
          aside={
            data && (
              <StageMetrics
                label={t.start.metricsLabel}
                items={[
                  {
                    key: 'due',
                    value: data.due.total,
                    label: t.start.metricDue,
                    accent: data.due.total > 0,
                  },
                  {
                    key: 'relationships',
                    value: data.relationships.total,
                    label: supplierSide ? t.start.metricCustomers : t.start.metricRelationships,
                  },
                ]}
              />
            )
          }
        />
      </InStageSlot>

      <div className="grid items-start gap-10 sidebar:grid-cols-3">
        {/* Zuerst im Dokument: Der Sprung-Link führt direkt zum Fragefeld (PLT-11, PLT-12); rechts
            steht die Spalte trotzdem. */}
        <aside className="flex flex-col gap-4 sidebar:col-start-3 sidebar:row-start-1">
          {data?.nextMeeting && (
            <NextMeetingTile meeting={data.nextMeeting} supplierSide={supplierSide} />
          )}
          {!supplierSide && <PromptTrigger />}
        </aside>
        {query.isError ? (
          <div className="sidebar:col-span-2 sidebar:col-start-1 sidebar:row-start-1">
            <ErrorState title={t.start.failed} />
          </div>
        ) : !data ? (
          <div className="sidebar:col-span-2 sidebar:col-start-1 sidebar:row-start-1">
            <LoadingState label={t.start.loading} />
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-10 sidebar:col-span-2 sidebar:col-start-1 sidebar:row-start-1">
            {data.due.items.length > 0 && (
              <section aria-labelledby="start-faellig" className="flex flex-col gap-3">
                <h2 id="start-faellig" className="font-bold text-xl tracking-title">
                  {t.start.dueTitle}
                </h2>
                <ol data-slot="due-list" className="overflow-hidden rounded-xl bg-card">
                  {data.due.items.map((item, index) => {
                    const what = dueTitle(t, item);
                    return (
                      <li
                        key={item.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-border border-b px-5 py-4 last:border-b-0"
                      >
                        <Monogram name={item.supplier} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="font-semibold">{what}</span>
                          <span className="text-muted-foreground text-sm">
                            {item.supplier} · {t.start.dueBy(formatDate(locale, item.dueDate))}
                          </span>
                        </span>
                        {routerLink({
                          href: item.href,
                          className: buttonVariants({
                            variant: index === 0 ? 'default' : 'outline',
                          }),
                          'aria-label': t.start.openItem(item.supplier, what),
                          children: t.start.open,
                        })}
                      </li>
                    );
                  })}
                </ol>
                {data.due.total > data.due.items.length &&
                  routerLink({
                    href: '/start/faellig',
                    className: cn(
                      buttonVariants({ variant: 'link' }),
                      'self-start px-0 has-[>svg]:px-0',
                    ),
                    children: (
                      <>
                        {t.start.allDue(data.due.total)}
                        <ChevronRightIcon aria-hidden />
                      </>
                    ),
                  })}
              </section>
            )}

            <section aria-labelledby="start-beziehungen" className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-4">
                <h2 id="start-beziehungen" className="font-bold text-xl tracking-title">
                  {supplierSide ? t.start.customersTitle : t.start.relationshipsTitle}
                </h2>
                {data.relationships.total > 0 &&
                  routerLink({
                    href: supplierSide ? '/kunden' : '/lieferanten',
                    className: cn(buttonVariants({ variant: 'link' }), 'px-0'),
                    children: t.start.all,
                  })}
              </div>
              {data.relationships.items.length === 0 ? (
                <EmptyState
                  icon={<UsersIcon aria-hidden />}
                  title={supplierSide ? t.start.customersEmpty : t.start.relationshipsEmpty}
                  description={
                    supplierSide ? t.start.customersEmptyHint : t.start.relationshipsEmptyHint
                  }
                  action={
                    supplierSide
                      ? undefined
                      : routerLink({
                          href: '/lieferanten',
                          className: buttonVariants({ variant: 'outline' }),
                          children: t.start.toSuppliers,
                        })
                  }
                />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.relationships.items.map((item) => (
                    <li key={item.id}>
                      {routerLink({
                        href: relationshipHref(item.id),
                        className:
                          'flex h-full flex-col gap-3 rounded-xl bg-card p-5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                        children: (
                          <>
                            <Monogram name={item.name} emphasis={Boolean(item.target)} />
                            <span className="font-semibold leading-snug">{item.name}</span>
                            {item.target && (
                              <span className="text-muted-foreground text-sm">
                                {t.start.target(item.target)}
                              </span>
                            )}
                          </>
                        ),
                      })}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Nächster Termin aus der Termin-Quelle (QBR-01b), als dunkle Kachel: Datum groß, Titel, die
 * andere Seite und ein Link zur Termin-Seite.
 */
function NextMeetingTile({
  meeting,
  supplierSide,
}: {
  meeting: NextMeeting;
  supplierSide: boolean;
}) {
  const t = useT();
  const { locale } = useLocale();
  const start = new Date(meeting.startsAt);
  const month = new Intl.DateTimeFormat(locale, { month: 'short' }).format(start);
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(start);
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(start);
  const href = `${supplierSide ? '/kunden' : '/lieferanten'}/${meeting.relationshipId}/umsetzung/termine/${meeting.id}`;
  return (
    <Tile data-slot="next-meeting">
      <p className="font-semibold text-primary text-sm">{t.meetings.next}</p>
      <div className="flex items-center gap-4">
        <p className="flex flex-col items-center rounded-lg border border-border px-3 py-1">
          <span className="font-semibold text-primary text-sm uppercase">{month}</span>
          <span className="font-bold text-2xl tabular-nums tracking-title">{day}</span>
        </p>
        <p className="flex min-w-0 flex-col">
          <span className="font-bold text-lg tracking-title">{meeting.title}</span>
          <span className="text-muted-foreground text-sm">
            {meeting.counterpart} · {time}
          </span>
        </p>
      </div>
      {routerLink({
        href,
        className: cn(buttonVariants({ variant: 'link' }), 'self-start px-0 has-[>svg]:px-0'),
        'aria-label': `${t.meetings.nextOpen}: ${meeting.title}`,
        children: (
          <>
            {t.meetings.nextOpen}
            <ChevronRightIcon aria-hidden />
          </>
        ),
      })}
    </Tile>
  );
}
