import type { DueItem, NextMeeting, StartData } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronRightIcon } from 'lucide-react';
import type * as React from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { DateCircle } from '@/components/ui/date-circle';
import { ErrorState } from '@/components/ui/error-state';
import { ListCard, ListCardHeader, ListRow } from '@/components/ui/list-card';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { NextStep, NextStepArrow } from '@/components/ui/next-step';
import { StageMetrics } from '@/components/ui/stage';
import { Tile } from '@/components/ui/tile';
import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { useMe } from '@/features/auth/use-me';
import { HintsAttention } from '@/features/hints/hints-attention';
import { PromptTrigger } from '@/features/prompt/prompt-trigger';
import { routerLink } from '@/features/shell/navigation';
import { useDocumentTitle } from '@/features/shell/page-header';
import { startQueryOptions } from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { dueTitle } from './due-title';
import { dayTime } from './greeting';

export { dueTitle, formatDate } from './due-title';

/**
 * Start der Lieferantenseite (PLT-11, NAV-05; Designsprache, Vorlage Main.dc.html): Datum, Begrüßung,
 * ein Satz zur Lage mit dem Knopf zu den fälligen Aufgaben, das Fragefeld; darunter die nächste
 * Aufgabe als Tinte-Karte, der nächste Termin, offene Entscheidungen bzw. Maßnahmen und rechts
 * Fokuslieferanten bzw. Kunden mit drei Zahlen. Speichert nichts; alles führt zum Ort der Sache.
 */
export function SupplierStartPage() {
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

  useDocumentTitle(supplierSide ? t.start.title : t.nav.myDay);

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

  const metrics = data && (
    <StageMetrics
      label={t.start.metricsLabel}
      items={
        portfolio
          ? [
              { key: 'suppliers', value: portfolio.suppliers, label: t.start.metricSuppliers },
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
                label: supplierSide ? t.start.metricCustomers : t.start.metricRelationships,
              },
              { key: 'actions', value: data.openActions, label: t.start.metricActions },
            ]
      }
    />
  );

  // Aufbau nach Vorlage Main.dc.html: Begrüßung groß, darunter das Fragefeld; links der nächste
  // Schritt als Tinte-Karte, der Termin und die Zahl; rechts „Im Blick“ mit Liste und Zahlen.
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className="font-semibold text-muted-foreground text-sm">{today}</p>
          <h1 className="text-balance text-title-work tracking-title-lg sm:text-title-hero">
            {me.data ? greeting(me.data.firstName) : t.start.greetingWithoutName}
          </h1>
        </div>
        {data && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-base text-muted-foreground">{t.start.todayTitle(data.due.total)}</p>
            {data.due.total > 0 &&
              routerLink({
                href: '/start/faellig',
                className: buttonVariants({ variant: 'secondary' }),
                children: t.start.toDue,
              })}
          </div>
        )}
        {/* Zuerst im Inhalt: Der Sprung-Link führt direkt zum Fragefeld (PLT-11, PLT-12). */}
        {!supplierSide && <PromptTrigger />}
      </div>
      {query.isError ? (
        <ErrorState title={t.start.failed} />
      ) : !data ? (
        <LoadingState label={t.start.loading} />
      ) : (
        <div data-slot="start-tiles" className="flex flex-wrap items-start gap-7">
          <div className="flex min-w-0 shrink grow-999 basis-140 flex-col gap-7">
            <DueTile item={data.due.items[0]} />
            {!supplierSide && !!data.ownOpenDrafts && (
              <section className={cn('rounded-lg bg-card', tileClass)}>
                <h2 className={titleClass}>{t.draftEvidence.prepared}</h2>
                <p>{t.draftEvidence.openCount(data.ownOpenDrafts)}</p>
                {/* NAV-10: Die Seite Agenten ist nur über Einstellungen, KI erreichbar. Die
                    Entwürfe stehen je Lieferant unter Aktivitäten, Filter Reziproq. */}
              </section>
            )}
            <MeetingTile meeting={data.nextMeeting} supplierSide={supplierSide} />
            <CountTile data={data} />
          </div>
          <aside
            aria-label={t.start.metricsLabel}
            className="flex min-w-0 shrink grow basis-75 flex-col gap-5"
          >
            {/* KI-16: rechts oben „Wo du handeln musst“ (Main.neu.dc.html) */}
            {!supplierSide && <HintsAttention />}
            {/* IN-03: „Neu eingegangen“, sobald eine Anbindung für Termine aktiv ist */}
            <ListTile data={data} supplierSide={supplierSide} />
            {metrics}
          </aside>
        </div>
      )}
    </div>
  );
}

const tileClass = 'gap-2 p-6 sm:p-7';
const linkClass = cn(buttonVariants({ variant: 'link' }), 'self-start px-0 has-[>svg]:px-0');
const titleClass = 'font-display font-semibold text-section tracking-section';

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

/**
 * Die nächste fällige Aufgabe als „Nächster Schritt“ (Tinte-Karte, die eine Hauptaktion der
 * Seite); sonst ein ruhiger Hinweis mit dem Weg zu den eigenen Maßnahmen.
 */
function DueTile({ item }: { item: DueItem | undefined }) {
  const t = useT();
  const { locale } = useLocale();
  if (!item) {
    return (
      <div data-slot="due-tile">
        <NextStep
          eyebrow={t.start.allTasks}
          title={t.start.dueEmpty}
          text={t.start.dueEmptyHint}
          action={
            <Button variant="mint" size="hero" asChild>
              {routerLink({
                href: '/start/massnahmen',
                className: '',
                children: (
                  <>
                    {t.actions.mine.link}
                    <NextStepArrow />
                  </>
                ),
              })}
            </Button>
          }
        />
      </div>
    );
  }
  const internal = item.kind === 'rating' || item.kind === 'cycle' || item.kind === 'approval';
  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${item.dueDate}T00:00:00`));
  return (
    <div data-slot="due-tile">
      <NextStep
        eyebrow={
          <span className="flex flex-wrap items-center gap-2">
            {internal && <VisibilityBadge visibility="internal" label={t.start.internal} />}
            {t.start.dueBy(date)}
          </span>
        }
        title={t.start.kind[item.kind]}
        text={
          item.detail && item.kind !== 'approval'
            ? `${item.supplier} · ${item.detail}`
            : item.supplier
        }
        secondary={
          <Button variant="dark" asChild>
            {routerLink({ href: '/start/faellig', className: '', children: t.start.allTasks })}
          </Button>
        }
        action={
          <Button variant="mint" size="hero" asChild>
            {routerLink({
              href: item.href,
              className: '',
              'aria-label': t.start.openItem(item.supplier, dueTitle(t, item)),
              children: (
                <>
                  {item.kind === 'rating'
                    ? t.start.rateNow
                    : item.kind === 'feedback'
                      ? t.start.giveFeedback
                      : t.start.open}
                  <NextStepArrow />
                </>
              ),
            })}
          </Button>
        }
      />
    </div>
  );
}

/**
 * Nächster Termin aus der Termin-Quelle (QBR-01b) als Tinte-Kachel: Datumskreis links, rechts
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
        <p className="font-semibold text-mint text-sm">{t.meetings.next}</p>
        <h2 className={titleClass}>{t.start.noMeeting}</h2>
        <p className="text-muted-foreground">{t.start.noMeetingHint}</p>
      </Tile>
    );
  }
  const start = new Date(meeting.startsAt);
  const time = new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(start);
  const href = `${supplierSide ? '/kunden' : '/lieferanten'}/${meeting.relationshipId}/umsetzung/termine/${meeting.id}`;
  return (
    <Tile
      tone="stage"
      data-slot="next-meeting"
      className={cn(tileClass, 'flex-row flex-wrap items-start gap-5')}
    >
      <span className="sr-only">{t.meetings.next}</span>
      <DateCircle date={start} locale={locale} tone="onInk" />
      <div className="flex min-w-0 flex-1 basis-60 flex-col gap-2">
        <Badge variant="shared" className="self-start">
          {t.start.sharedWith(meeting.counterpart)}
        </Badge>
        <h2 className={titleClass}>{meeting.title}</h2>
        <p className="text-base">
          {meeting.counterpart} · <span className="tabular-nums">{time}</span>
        </p>
        {meeting.location && <p className="text-muted-foreground">{meeting.location}</p>}
        <TileLink href={href} label={`${t.start.agenda}: ${meeting.title}`}>
          {t.start.agenda}
        </TileLink>
      </div>
    </Tile>
  );
}

/**
 * Käufer: Fokuslieferanten mit Stand der Spielregeln. Lieferant (oder Käufer ohne Portfolio): die
 * eigenen Kunden bzw. Beziehungen. Als Listenkarte (Vorlage: „Im Blick“).
 */
function ListTile({ data, supplierSide }: { data: StartData; supplierSide: boolean }) {
  const t = useT();
  const focus = data.portfolio?.focus;
  const rows = focus
    ? focus.map((item) => ({
        id: item.id,
        name: item.name,
        badge: item.rulesShared ? (
          <Badge variant="shared">{t.start.rulesShared}</Badge>
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
    <ListCard data-slot="list-tile" aria-labelledby="start-liste">
      <ListCardHeader id="start-liste" title={title} />
      {rows.length === 0 ? (
        <p className="px-5.5 pb-5.5 text-muted-foreground">{empty}</p>
      ) : (
        <ul aria-labelledby="start-liste">
          {rows.map((row) => (
            <li key={row.id}>
              <ListRow asChild>
                {routerLink({
                  href: `${base}/${row.id}`,
                  className: '',
                  children: (
                    <>
                      <Monogram name={row.name} />
                      <span className="min-w-0 flex-1 truncate font-semibold">{row.name}</span>
                      {row.badge}
                    </>
                  ),
                })}
              </ListRow>
            </li>
          ))}
        </ul>
      )}
      <div className="border-line-soft border-t px-5.5 py-2">
        {focus ? (
          <TileLink href="/portfolio">{t.start.toPortfolio}</TileLink>
        ) : (
          data.relationships.total > 0 && <TileLink href={base}>{t.start.all}</TileLink>
        )}
      </div>
    </ListCard>
  );
}

/** Eine große Zahl: offene Entscheidungen beim Käufer, sonst offene Maßnahmen. */
function CountTile({ data }: { data: StartData }) {
  const t = useT();
  const decisions = data.portfolio;
  const value = decisions ? decisions.openDecisions : data.openActions;
  return (
    <Tile
      tone="shared"
      data-slot="count-tile"
      className={cn(tileClass, 'flex-row flex-wrap items-center gap-5')}
    >
      <p className="font-display font-semibold text-petrol-dark text-title-hero tabular-nums leading-none tracking-title-lg">
        {value}
      </p>
      <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
        <h2 className={titleClass}>{decisions ? t.start.decisionsTitle : t.start.actionsTitle}</h2>
        <p className="text-muted-foreground">
          {decisions ? t.start.decisionsText : t.start.actionsText}
        </p>
        {decisions ? (
          <TileLink href="/portfolio/offen">{t.start.decisionsLink}</TileLink>
        ) : (
          <TileLink href="/start/massnahmen">{t.start.actionsLink}</TileLink>
        )}
        {data.openHints !== undefined && data.openHints > 0 && (
          <TileLink href="/heute?ansicht=alles">{t.hints.count(data.openHints)}</TileLink>
        )}
      </div>
    </Tile>
  );
}
