import type { DueItem, NextMeeting, StartData } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronRightIcon } from 'lucide-react';
import type * as React from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Stage, StageMetrics } from '@/components/ui/stage';
import { Tile } from '@/components/ui/tile';
import { VisibilityBadge } from '@/components/ui/visibility-badge';
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
  if (item.kind === 'action') return t.start.dueAction(item.detail);
  if (item.kind === 'approval') return t.start.dueApproval(item.supplier);
  if (item.kind === 'commitment') return t.start.dueCommitment(item.detail);
  if (item.kind === 'milestone') return t.start.dueMilestone(item.detail);
  if (item.kind === 'review') return t.start.dueReview(item.supplier);
  if (item.kind === 'signature') return t.start.dueSignature(item.supplier);
  if (item.kind === 'validation') return t.start.dueValidation(item.detail);
  return t.start.dueRating(item.detail);
}

export function formatDate(locale: string, date: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(`${date}T00:00:00`),
  );
}

/**
 * Start nach dem Login (PLT-11, NAV-05, Handschrift Bühne A2): dunkle Bühne mit Datum, Begrüßung,
 * einem Satz zur Lage, einem Knopf zu den fälligen Aufgaben und drei Zahlen. Darunter das
 * Fragefeld und vier Kacheln: nächste Aufgabe, nächster Termin, Fokuslieferanten bzw. Kunden und
 * offene Entscheidungen bzw. Maßnahmen. Speichert nichts; jede Kachel führt zum Ort der Sache.
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
  const portfolio = data?.portfolio ?? null;

  return (
    <>
      <InStageSlot>
        <Stage
          eyebrow={today}
          title={me.data ? greeting(me.data.firstName) : t.start.greetingWithoutName}
          text={data && t.start.todayTitle(data.due.total)}
          actions={
            data &&
            data.due.total > 0 &&
            routerLink({
              href: '/start/faellig',
              className: buttonVariants({ size: 'lg' }),
              children: t.start.toDue,
            })
          }
          aside={
            data && (
              <StageMetrics
                label={t.start.metricsLabel}
                items={
                  portfolio
                    ? [
                        {
                          key: 'suppliers',
                          value: portfolio.suppliers,
                          label: t.start.metricSuppliers,
                        },
                        { key: 'focus', value: portfolio.focusTotal, label: t.start.metricFocus },
                        {
                          key: 'decisions',
                          value: portfolio.openDecisions,
                          label: t.start.metricDecisions,
                          accent: portfolio.openDecisions > 0,
                        },
                      ]
                    : [
                        {
                          key: 'due',
                          value: data.due.total,
                          label: t.start.metricDue,
                          accent: data.due.total > 0,
                        },
                        {
                          key: 'relationships',
                          value: data.relationships.total,
                          label: supplierSide
                            ? t.start.metricCustomers
                            : t.start.metricRelationships,
                        },
                        {
                          key: 'actions',
                          value: data.openActions,
                          label: t.start.metricActions,
                        },
                      ]
                }
              />
            )
          }
        />
      </InStageSlot>

      <div className="flex flex-col gap-4">
        {/* Zuerst im Inhalt: Der Sprung-Link führt direkt zum Fragefeld (PLT-11, PLT-12). */}
        {!supplierSide && <PromptTrigger />}
        {query.isError ? (
          <ErrorState title={t.start.failed} />
        ) : !data ? (
          <LoadingState label={t.start.loading} />
        ) : (
          <div data-slot="start-tiles" className="grid gap-4 md:grid-cols-2">
            <DueTile item={data.due.items[0]} />
            <MeetingTile meeting={data.nextMeeting} supplierSide={supplierSide} />
            <ListTile data={data} supplierSide={supplierSide} />
            <CountTile data={data} />
          </div>
        )}
      </div>
    </>
  );
}

const tileClass = 'min-h-72 gap-2 p-6 sm:p-10';
const linkClass = cn(buttonVariants({ variant: 'link' }), 'self-start px-0 has-[>svg]:px-0');
const titleClass = 'font-bold text-xl tracking-title sm:text-2xl';

/** Link mit Pfeil am Fuß einer Kachel */
function TileLink({
  href,
  label,
  children,
}: {
  href: string;
  label?: string;
  children: React.ReactNode;
}) {
  return routerLink({
    href,
    className: linkClass,
    ...(label ? { 'aria-label': label } : {}),
    children: (
      <>
        {children}
        <ChevronRightIcon aria-hidden />
      </>
    ),
  });
}

/** Die nächste fällige Aufgabe, groß, mit einem Knopf; sonst ein ruhiger Hinweis. */
function DueTile({ item }: { item: DueItem | undefined }) {
  const t = useT();
  const { locale } = useLocale();
  if (!item) {
    return (
      <Tile data-slot="due-tile" className={tileClass}>
        <h2 className={titleClass}>{t.start.dueEmpty}</h2>
        <p className="text-muted-foreground">{t.start.dueEmptyHint}</p>
        <span className="grow" />
        <TileLink href="/start/massnahmen">{t.actions.mine.link}</TileLink>
      </Tile>
    );
  }
  const internal = item.kind === 'rating' || item.kind === 'cycle' || item.kind === 'approval';
  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${item.dueDate}T00:00:00`));
  return (
    <Tile data-slot="due-tile" className={tileClass}>
      {internal && <VisibilityBadge visibility="internal" label={t.start.internal} />}
      <h2 className={cn(titleClass, 'mt-2')}>{t.start.kind[item.kind]}</h2>
      <p className="text-lg">
        {item.detail && item.kind !== 'approval'
          ? `${item.supplier} · ${item.detail}`
          : item.supplier}
      </p>
      <p className="text-muted-foreground">{t.start.dueBy(date)}</p>
      <span className="grow" />
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        {routerLink({
          href: item.href,
          className: buttonVariants(),
          'aria-label': t.start.openItem(item.supplier, dueTitle(t, item)),
          children: item.kind === 'rating' ? t.start.rateNow : t.start.open,
        })}
        <TileLink href="/start/faellig">{t.start.allTasks}</TileLink>
      </div>
    </Tile>
  );
}

/**
 * Nächster Termin aus der Termin-Quelle (QBR-01b), als dunkle Kachel: Datum groß links, rechts
 * Titel, die andere Seite und der Link zur Agenda.
 */
function MeetingTile({
  meeting,
  supplierSide,
}: {
  meeting: NextMeeting | null;
  supplierSide: boolean;
}) {
  const t = useT();
  const { locale } = useLocale();
  if (!meeting) {
    return (
      <Tile tone="stage" data-slot="next-meeting" className={tileClass}>
        <p className="font-semibold text-primary text-sm">{t.meetings.next}</p>
        <h2 className={cn(titleClass, 'mt-2')}>{t.start.noMeeting}</h2>
        <p className="text-muted-foreground">{t.start.noMeetingHint}</p>
      </Tile>
    );
  }
  const start = new Date(meeting.startsAt);
  const month = new Intl.DateTimeFormat(locale, { month: 'long' }).format(start);
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(start);
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(start);
  const href = `${supplierSide ? '/kunden' : '/lieferanten'}/${meeting.relationshipId}/umsetzung/termine/${meeting.id}`;
  return (
    <Tile
      tone="stage"
      data-slot="next-meeting"
      className={cn(tileClass, 'grid grid-cols-[auto_1fr] items-start gap-6 sm:gap-8')}
    >
      <p className="flex flex-col items-center rounded-xl border border-border px-4 py-3 sm:px-5">
        <span className="sr-only">{t.meetings.next}</span>
        <span className="font-semibold text-primary text-sm uppercase">{month}</span>
        <span className="font-bold text-2xl tabular-nums tracking-title sm:text-display sm:leading-none">
          {day}
        </span>
        <span className="text-muted-foreground text-sm">{time}</span>
      </p>
      <div className="flex h-full min-w-0 flex-col gap-2">
        <Badge variant="selected">{t.start.sharedWith(meeting.counterpart)}</Badge>
        <h2 className={cn(titleClass, 'mt-2')}>{meeting.title}</h2>
        <p className="text-lg">{meeting.counterpart}</p>
        {meeting.location && <p className="text-muted-foreground">{meeting.location}</p>}
        <span className="grow" />
        <TileLink href={href} label={`${t.start.agenda}: ${meeting.title}`}>
          {t.start.agenda}
        </TileLink>
      </div>
    </Tile>
  );
}

/**
 * Käufer: Fokuslieferanten mit Stand der Spielregeln. Lieferant (oder Käufer ohne Portfolio): die
 * eigenen Kunden bzw. Beziehungen.
 */
function ListTile({ data, supplierSide }: { data: StartData; supplierSide: boolean }) {
  const t = useT();
  const focus = data.portfolio?.focus;
  const rows = focus
    ? focus.map((item) => ({
        id: item.id,
        name: item.name,
        badge: item.rulesShared ? (
          <Badge variant="selected">{t.start.rulesShared}</Badge>
        ) : (
          <Badge>{t.start.internalShort}</Badge>
        ),
      }))
    : data.relationships.items.map((item) => ({
        id: item.id,
        name: item.name,
        badge: item.target ? <Badge>{item.target}</Badge> : null,
      }));
  const title = focus
    ? t.start.focusTitle
    : supplierSide
      ? t.start.customersTitle
      : t.start.relationshipsTitle;
  const empty = focus
    ? t.start.focusEmpty
    : supplierSide
      ? t.start.customersEmpty
      : t.start.relationshipsEmpty;
  const base = supplierSide ? '/kunden' : '/lieferanten';
  return (
    <Tile data-slot="list-tile" className={tileClass}>
      <h2 id="start-liste" className="font-bold text-xl tracking-title">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">{empty}</p>
      ) : (
        <ul aria-labelledby="start-liste" className="mt-2">
          {rows.map((row) => (
            <li key={row.id} className="border-border border-t">
              {routerLink({
                href: `${base}/${row.id}`,
                className:
                  'flex min-h-12 items-center gap-3 py-2 hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                children: (
                  <>
                    <span className="min-w-0 flex-1 truncate">{row.name}</span>
                    {row.badge}
                  </>
                ),
              })}
            </li>
          ))}
        </ul>
      )}
      <span className="grow" />
      {focus ? (
        <TileLink href="/portfolio">{t.start.toPortfolio}</TileLink>
      ) : (
        data.relationships.total > 0 && <TileLink href={base}>{t.start.all}</TileLink>
      )}
    </Tile>
  );
}

/** Eine große Zahl: offene Entscheidungen beim Käufer, sonst offene Maßnahmen. */
function CountTile({ data }: { data: StartData }) {
  const t = useT();
  const decisions = data.portfolio;
  const value = decisions ? decisions.openDecisions : data.openActions;
  return (
    <Tile tone="shared" data-slot="count-tile" className={tileClass}>
      <p className="font-bold text-display text-primary tabular-nums leading-none tracking-title">
        {value}
      </p>
      <h2 className="mt-2 font-bold text-xl tracking-title">
        {decisions ? t.start.decisionsTitle : t.start.actionsTitle}
      </h2>
      <p className="text-muted-foreground">
        {decisions ? t.start.decisionsText : t.start.actionsText}
      </p>
      <span className="grow" />
      {decisions ? (
        <TileLink href="/portfolio/offen">{t.start.decisionsLink}</TileLink>
      ) : (
        <TileLink href="/start/massnahmen">{t.start.actionsLink}</TileLink>
      )}
    </Tile>
  );
}
