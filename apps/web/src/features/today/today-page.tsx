import {
  type AllTopic,
  type DueBucket,
  dueBucketOf,
  dueBuckets,
  type FocusArt,
  type FocusTopic,
  focusArts,
  type TodayAll,
  type TodayPage as TodayPageData,
  type WaitingItem,
  type WeekEntry,
} from '@reziproq/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type * as React from 'react';
import { useId, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { BrandMark } from '@/components/ui/brand-mark';
import { Button } from '@/components/ui/button';
import { DateCircle } from '@/components/ui/date-circle';
import { AreaSwitch } from '@/components/ui/entity-header';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { NextCard } from '@/components/ui/next-card';
import { PageTitle } from '@/components/ui/page-title';
import { Row, RowGroup } from '@/components/ui/row-group';
import { SoWhat } from '@/components/ui/so-what';
import { useMe } from '@/features/auth/use-me';
import { routerLink } from '@/features/shell/navigation';
import { useDocumentTitle } from '@/features/shell/page-header';
import { dueTitle } from '@/features/start/due-title';
import { dayTime } from '@/features/start/greeting';
import { shortDate, weekdayTime } from '@/features/start/next-action';
import { snoozeTopic, todayAllQueryOptions, todayQueryOptions } from '@/lib/api';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { todayMessages } from './today-messages';

type Text = (typeof todayMessages)['de'];
type Severity = 'high' | 'medium' | 'low';

export type TodayView = 'focus' | 'all';

/** Filter der Ansicht Alles, wie sie in der Adresse stehen (HE-01) */
export interface TodayFilters {
  beziehung?: string | undefined;
  warengruppe?: string | undefined;
  art?: FocusArt | undefined;
  schwere?: Severity | undefined;
  frist?: DueBucket | undefined;
}

export const filterKeys = ['beziehung', 'warengruppe', 'art', 'schwere', 'frist'] as const;
type FilterKey = (typeof filterKeys)[number];

/**
 * Heute (HE-01, NAV-10 2.0; Vorlagen `Main`, `A-MeinTag`, `Heute-Alles`): Kopf mit Datum, Gruß und
 * dem Umschalter Fokus | Alles. Fokus zeigt genau eine Karte „Als Nächstes“, „Das Wichtigste“ mit
 * den übrigen Fokus-Themen (zusammen höchstens drei), Kurz prüfen, Erledigt im Hintergrund und
 * rechts „Diese Woche“, „Wartet auf andere“ und „Alles anzeigen“. Alles zeigt jedes offene Thema.
 */
export function TodayPage({ view, filters }: { view: TodayView; filters: TodayFilters }) {
  const text = useMessages(todayMessages);
  useDocumentTitle(text.title);
  return view === 'all' ? <AllView filters={filters} /> : <FocusView />;
}

function useWhere(text: Text) {
  const t = useT();
  const { locale } = useLocale();
  const me = useMe();
  const greeting = {
    morning: t.start.greetingMorning,
    day: t.start.greetingDay,
    evening: t.start.greetingEvening,
  }[dayTime(new Date())];
  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return text.where(date, me.data ? greeting(me.data.firstName) : t.start.greetingWithoutName);
}

/** Kopf beider Ansichten: Titel, Ort, auf dem Telefon die Person, darunter Fokus | Alles */
function TodayHeader({ view, where }: { view: TodayView; where: React.ReactNode }) {
  const text = useMessages(todayMessages);
  const me = useMe();
  // Auf dem Telefon führt die Person zu den Einstellungen (NAV-10 Ablauf 14); ab 761 px steht
  // beides in der Seitenleiste.
  const person = me.data && (
    <span className="shell:hidden">
      {routerLink({
        href: '/einstellungen',
        'aria-label': text.settings,
        className: 'flex size-11 items-center justify-center rounded-full no-underline',
        children: <Monogram name={me.data.name} tone="ink" />,
      })}
    </span>
  );
  return (
    <div className="flex flex-col gap-5.5">
      <PageTitle title={text.title} where={where} aside={person} />
      <div className="max-w-80">
        <AreaSwitch
          label={text.views.label}
          active={view}
          renderLink={routerLink}
          areas={[
            { key: 'focus', label: text.views.focus, href: '/heute' },
            { key: 'all', label: text.views.all, href: '/heute?ansicht=alles' },
          ]}
        />
      </div>
    </div>
  );
}

/** Titel eines Fokus-Themas: je Art aus der Frist des Moduls, sonst der Titel der Triage */
function useTopicTitle() {
  const t = useT();
  return (topic: Pick<FocusTopic, 'item' | 'title' | 'objectType'>) => {
    if (topic.item) return dueTitle(t, topic.item);
    const rules = t.hints.rules as Record<string, string>;
    if (topic.objectType === 'hint' && Object.hasOwn(rules, topic.title)) {
      return rules[topic.title] ?? topic.title;
    }
    return topic.title;
  };
}

function topicDetail(text: Text, topic: FocusTopic) {
  return text.all.topicDetail(
    topic.counterpart,
    text.arts[topic.art],
    topic.severity ? text.severity[topic.severity] : null,
  );
}

const severityTone = { high: 'danger', medium: 'warning', low: 'neutral' } as const;

/** Datum mit Uhrzeit für Termine, die Wochen entfernt sein können, z. B. „Fr 11.12. 10:00“ */
function dateTime(locale: string, iso: string) {
  const value = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    value,
  );
  return `${shortDate(locale, date)} ${time}`;
}

// ————————————————————————————————————————— Fokus —————————————————————————————————————————

function FocusView() {
  const text = useMessages(todayMessages);
  const where = useWhere(text);
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({ ...todayQueryOptions(accessToken), enabled: accessToken !== '' });
  const data = query.data;
  if (query.isError) {
    return (
      <div className="flex flex-col gap-5.5">
        <TodayHeader view="focus" where={where} />
        <ErrorState
          title={text.failed}
          action={
            <Button variant="secondary" onClick={() => query.refetch()}>
              {text.retry}
            </Button>
          }
        />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-5.5">
        <TodayHeader view="focus" where={where} />
        <LoadingState label={text.loading} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5.5">
      <TodayHeader view="focus" where={where} />
      <div className="grid gap-5.5 wide:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5.5">
          {data.next && <NextTopic data={data} topic={data.next} />}
          <Important data={data} />
          <ReviewBlock data={data} />
          <DoneRow data={data} />
        </div>
        <aside className="flex min-w-0 flex-col gap-5.5">
          <WeekGroup entries={data.week} />
          <WaitingGroup items={data.waiting} total={data.waitingTotal} today={data.today} />
          <RowGroup>
            <Row
              href="/heute?ansicht=alles"
              title={text.allRow.title}
              detail={text.allRow.detail(data.counts)}
              renderLink={routerLink}
            />
          </RowGroup>
        </aside>
      </div>
    </div>
  );
}

/**
 * „Als Nächstes“: das Fokus-Thema mit der höchsten Punktzahl. Der Hauptknopf führt zum Ort der
 * Erledigung, bis die Fokus-Mappe kommt (K1-e.4); „Morgen erinnern“ stellt es bis 07:00 zurück.
 */
function NextTopic({ data, topic }: { data: TodayPageData; topic: FocusTopic }) {
  const text = useMessages(todayMessages);
  const title = useTopicTitle()(topic);
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const client = useQueryClient();
  const snooze = useMutation({
    mutationFn: () => snoozeTopic(accessToken, topic.id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['heute'] }),
  });
  const shown = 1 + data.more.length;
  const href = topic.href ?? '/heute?ansicht=alles';
  return (
    <div className="flex flex-col gap-2">
      <NextCard
        kicker={text.next.kicker(1, shown, topic.counterpart)}
        title={title}
        text={topic.sentence}
        action={{ label: text.next.open, href, ariaLabel: text.next.openLabel(title) }}
        secondary={
          <Button
            variant="dark"
            size="lg"
            className="w-full shell:w-auto"
            loading={snooze.isPending}
            onClick={() => snooze.mutate()}
          >
            {text.next.snooze}
          </Button>
        }
        renderLink={routerLink}
      />
      {snooze.isError && (
        <p role="alert" className="px-1 text-destructive text-sm">
          {text.next.snoozeFailed}
        </p>
      )}
    </div>
  );
}

/** „Das Wichtigste“: Satz von Reziproq mit Quellen und die übrigen Fokus-Themen */
function Important({ data }: { data: TodayPageData }) {
  const text = useMessages(todayMessages);
  const title = useTopicTitle();
  return (
    <section aria-label={text.important.label}>
      <SoWhat
        heading={text.important.heading}
        statement={data.summary.sentence}
        sources={data.summary.sources.map((source) => text.sources[source])}
        renderLink={routerLink}
      >
        {data.more.length > 0 && (
          <div className="flex flex-col divide-y divide-row-line overflow-hidden rounded-md border border-row-line">
            {data.more.map((topic) => (
              <Row
                key={topic.id}
                {...(topic.href ? { href: topic.href } : {})}
                title={title(topic)}
                detail={topicDetail(text, topic)}
                value={<Badge variant="warning">{text.arts[topic.art]}</Badge>}
                renderLink={routerLink}
              />
            ))}
          </div>
        )}
      </SoWhat>
    </section>
  );
}

/**
 * Kurz prüfen: Zahl und Minuten, darunter die Entwürfe als Zeilen; auf dem Telefon eine Zeile
 * (Vorlage A-MeinTag). Ein Entwurf öffnet seinen Ort, bis Kurz prüfen kommt (K1-e.2).
 */
function ReviewBlock({ data }: { data: TodayPageData }) {
  const text = useMessages(todayMessages);
  const { locale } = useLocale();
  if (data.drafts.length === 0) return null;
  const label = text.review.label(data.review.count, data.review.minutes);
  return (
    <>
      <div className="hidden shell:block">
        <RowGroup label={label}>
          {data.drafts.map((draft) => (
            <Row
              key={draft.id}
              {...(draft.href ? { href: draft.href } : {})}
              lead={<BrandMark />}
              title={draft.title}
              detail={text.review.detail(draft.counterpart, weekdayTime(locale, draft.createdAt))}
              value={<Badge variant="shared">{text.review.chip}</Badge>}
              renderLink={routerLink}
            />
          ))}
        </RowGroup>
      </div>
      <div className="shell:hidden">
        <RowGroup>
          <Row
            {...(data.drafts[0]?.href ? { href: data.drafts[0].href } : {})}
            title={text.review.phoneTitle}
            detail={text.review.phoneDetail(data.review.count, data.review.minutes)}
            value={<Badge variant="shared">{data.review.count}</Badge>}
            renderLink={routerLink}
          />
        </RowGroup>
      </div>
    </>
  );
}

/** Erledigt im Hintergrund: eine Zeile mit Zahl und Arten; die Seite Erledigt kommt mit K1-e.3 */
function DoneRow({ data }: { data: TodayPageData }) {
  const text = useMessages(todayMessages);
  return (
    <RowGroup>
      <Row
        title={text.done.title(data.done.count)}
        detail={data.done.count > 0 ? text.done.tasks(data.done.tasks) : text.done.none}
      />
    </RowGroup>
  );
}

/** „Diese Woche“ (E-K1-4): Datumskreis in Tinte für eigene Fristen, Petrol, wenn andere dran sind */
function WeekGroup({ entries }: { entries: WeekEntry[] }) {
  const text = useMessages(todayMessages);
  const { locale } = useLocale();
  const title = useTopicTitle();
  return (
    <RowGroup label={text.week.label}>
      {entries.length === 0 ? (
        <Row title={text.week.empty} />
      ) : (
        entries.map((entry) =>
          entry.turn === 'own' ? (
            <Row
              key={entry.topic.id}
              {...(entry.topic.href ? { href: entry.topic.href } : {})}
              lead={
                <DateCircle date={entry.date} locale={locale} next size="sm" caption="weekday" />
              }
              title={title(entry.topic)}
              detail={topicDetail(text, entry.topic)}
              renderLink={routerLink}
            />
          ) : (
            <Row
              key={entry.waiting.id}
              href={entry.waiting.href}
              lead={
                <DateCircle
                  date={entry.date}
                  locale={locale}
                  tone="petrol"
                  size="sm"
                  caption="weekday"
                />
              }
              title={entry.waiting.title}
              detail={[
                entry.waiting.owner === entry.waiting.counterpart
                  ? null
                  : entry.waiting.counterpart,
                text.week.counterpartTurn(entry.waiting.owner || entry.waiting.counterpart),
              ]
                .filter(Boolean)
                .join(' · ')}
              renderLink={routerLink}
            />
          ),
        )
      )}
    </RowGroup>
  );
}

function waitingWhen(text: Text, locale: string, item: WaitingItem, today: string) {
  if (item.dueDate < today) {
    const days = Math.round(
      (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${item.dueDate}T00:00:00Z`)) / 86_400_000,
    );
    return text.waiting.overdue(days);
  }
  return text.waiting.due(shortDate(locale, item.dueDate));
}

/** „Wartet auf andere“: die nächsten zwei; alle stehen in Alles unter „Bei anderen“ */
function WaitingGroup({
  items,
  total,
  today,
}: {
  items: WaitingItem[];
  total: number;
  today: string;
}) {
  const text = useMessages(todayMessages);
  const { locale } = useLocale();
  return (
    <RowGroup label={text.waiting.label(total)}>
      {items.length === 0 ? (
        <Row title={text.waiting.empty} />
      ) : (
        items.map((item) => (
          <Row
            key={item.id}
            href={item.href}
            lead={<Monogram name={item.owner || item.counterpart} tone="petrol" />}
            title={item.title}
            detail={text.all.othersDetail(
              item.owner,
              item.counterpart,
              waitingWhen(text, locale, item, today),
            )}
            renderLink={routerLink}
          />
        ))
      )}
    </RowGroup>
  );
}

// ————————————————————————————————————————— Alles —————————————————————————————————————————

function matchesTopic(topic: AllTopic, filters: TodayFilters, today: string) {
  return (
    (!filters.beziehung || topic.relationshipId === filters.beziehung) &&
    (!filters.warengruppe || topic.materialGroup === filters.warengruppe) &&
    (!filters.art || topic.art === filters.art) &&
    (!filters.schwere || topic.severity === filters.schwere) &&
    (!filters.frist || dueBucketOf(topic.dueDate, today) === filters.frist)
  );
}

function AllView({ filters }: { filters: TodayFilters }) {
  const text = useMessages(todayMessages);
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({ ...todayAllQueryOptions(accessToken), enabled: accessToken !== '' });
  const data = query.data;
  const header = <TodayHeader view="all" where={text.all.where} />;
  if (query.isError) {
    return (
      <div className="flex flex-col gap-5.5">
        {header}
        <ErrorState
          title={text.all.failed}
          action={
            <Button variant="secondary" onClick={() => query.refetch()}>
              {text.retry}
            </Button>
          }
        />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex flex-col gap-5.5">
        {header}
        <LoadingState label={text.all.loading} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5.5">
      {header}
      <FilterBar data={data} filters={filters} />
      <div className="grid gap-5.5 wide:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5.5">
          <AllGroups data={data} filters={filters} />
          <p className="px-1 text-input-border text-sm">{text.all.footer}</p>
        </div>
        <AllAside data={data} />
      </div>
    </div>
  );
}

/** Gruppen der Ansicht Alles (E-K0-26); ein Filter blendet nur aus, was die Person wählt */
function AllGroups({ data, filters }: { data: TodayAll; filters: TodayFilters }) {
  const text = useMessages(todayMessages);
  const t = useT();
  const { locale } = useLocale();
  const title = useTopicTitle();
  const active = filterKeys.some((key) => filters[key]);
  const onlyRelationship =
    !filters.warengruppe && !filters.art && !filters.schwere && !filters.frist;
  const relationship = (id: string | null) => !filters.beziehung || id === filters.beziehung;

  const forYou = data.forYou.filter((topic) => matchesTopic(topic, filters, data.today));
  const drafts = onlyRelationship
    ? data.drafts.rows.filter((draft) => relationship(draft.relationshipId))
    : [];
  const others = data.others.filter(
    (item) =>
      relationship(item.relationshipId) &&
      (!filters.warengruppe || item.materialGroup === filters.warengruppe) &&
      (!filters.art || (item.kind === 'commitment' ? 'zusage' : 'aufgabe') === filters.art) &&
      !filters.schwere &&
      (!filters.frist || dueBucketOf(item.dueDate, data.today) === filters.frist),
  );
  const hints = data.hints.filter(
    (hint) =>
      relationship(hint.relationshipId) &&
      (!filters.warengruppe || hint.materialGroup === filters.warengruppe) &&
      (!filters.art || filters.art === 'hinweis') &&
      (!filters.schwere || hint.severity === filters.schwere) &&
      (!filters.frist || filters.frist === 'ohne'),
  );
  const assign = onlyRelationship
    ? data.assign.filter(
        (item) =>
          !filters.beziehung ||
          item.suggestions.some((entry) => entry.relationshipId === filters.beziehung),
      )
    : [];
  const showCommitments = !active && data.commitments.open > 0;
  const nothing =
    active && forYou.length + drafts.length + others.length + hints.length + assign.length === 0;

  const chipOf = (topic: AllTopic) => {
    if (topic.snoozed) return <Badge>{text.all.chips.snoozed}</Badge>;
    if (topic.rank <= 3) return <Badge variant="shared">{text.all.chips.focus}</Badge>;
    if (topic.rank === 4) return <Badge variant="warning">{text.all.chips.next}</Badge>;
    if (topic.dueDate && topic.dueDate < data.today) {
      return <Badge variant="danger">{text.all.chips.overdue}</Badge>;
    }
    return topic.dueDate ? <Badge>{shortDate(locale, topic.dueDate)}</Badge> : undefined;
  };

  if (nothing) {
    return (
      <RowGroup>
        <Row title={text.all.filters.none} />
      </RowGroup>
    );
  }
  return (
    <>
      <RowGroup label={text.all.groups.forYou(forYou.length)}>
        {forYou.length === 0 ? (
          <Row title={text.all.forYouEmpty} />
        ) : (
          forYou.map((topic) => (
            <Row
              key={topic.id}
              {...(topic.href ? { href: topic.href } : {})}
              lead={
                <span className="flex items-center gap-3">
                  <span className="w-5.5 text-right font-semibold text-input-border text-sm tabular-nums">
                    <span className="sr-only">{text.all.rank(topic.rank)}</span>
                    <span aria-hidden>{topic.rank}</span>
                  </span>
                  {/* Auf dem Telefon nur der Platz, damit der Titel Raum hat */}
                  <span className="hidden shell:flex">
                    <Monogram
                      name={topic.counterpart ?? title(topic)}
                      tone={topic.counterpart ? 'petrol' : 'neutral'}
                    />
                  </span>
                </span>
              }
              title={title(topic)}
              detail={topicDetail(text, topic)}
              value={chipOf(topic)}
              renderLink={routerLink}
            />
          ))
        )}
      </RowGroup>

      {drafts.length > 0 && (
        <RowGroup label={text.all.groups.drafts(drafts.length)}>
          {drafts.map((draft) => (
            <Row
              key={draft.id}
              {...(draft.href ? { href: draft.href } : {})}
              lead={<BrandMark />}
              title={draft.title}
              detail={text.review.detail(draft.counterpart, weekdayTime(locale, draft.createdAt))}
              value={<Badge variant="shared">{text.review.chip}</Badge>}
              renderLink={routerLink}
            />
          ))}
        </RowGroup>
      )}

      {others.length > 0 && (
        <RowGroup label={text.all.groups.others(others.length)}>
          {others.map((item) => (
            <Row
              key={item.id}
              href={item.href}
              lead={<Monogram name={item.owner || item.counterpart} tone="petrol" />}
              title={item.title}
              detail={text.all.othersDetail(
                item.owner,
                item.counterpart,
                waitingWhen(text, locale, item, data.today),
              )}
              value={
                item.inFocus ? (
                  <Badge variant="shared">{text.all.chips.inFocus}</Badge>
                ) : item.dueDate < data.today ? (
                  <Badge variant="danger">{text.all.chips.overdue}</Badge>
                ) : (
                  <Badge>{shortDate(locale, item.dueDate)}</Badge>
                )
              }
              renderLink={routerLink}
            />
          ))}
        </RowGroup>
      )}

      {hints.length > 0 && (
        <RowGroup label={text.all.groups.hints(hints.length)}>
          {hints.map((hint) => {
            const rules = t.hints.rules as Record<string, string>;
            const rule = rules[hint.ruleKey] ?? hint.ruleKey;
            return (
              <Row
                key={hint.id}
                href={hint.href}
                lead={<Monogram name={hint.supplier ?? rule} tone="petrol" />}
                title={hint.title ?? rule}
                detail={text.all.hintDetail(
                  hint.supplier,
                  rule,
                  hint.materialGroup,
                  shortDate(locale, hint.openSince.slice(0, 10)),
                )}
                value={
                  <Badge variant={severityTone[hint.severity]}>
                    {text.severity[hint.severity]}
                  </Badge>
                }
                renderLink={routerLink}
              />
            );
          })}
        </RowGroup>
      )}

      {assign.length > 0 && (
        <RowGroup label={text.all.groups.assign(assign.length)}>
          {assign.map((item) => (
            <Row
              key={item.id}
              href={item.href}
              title={item.subject}
              detail={text.all.assignDetail(
                dateTime(locale, item.startsAt),
                item.suggestionKind === 'event'
                  ? text.all.assignEvent
                  : item.suggestions.map((entry) => entry.name).join(', ') || null,
              )}
              renderLink={routerLink}
            />
          ))}
        </RowGroup>
      )}

      {showCommitments && (
        <RowGroup label={text.all.groups.commitments(data.commitments.open)}>
          <Row
            href="/beziehungen"
            title={text.all.commitmentsTitle(data.commitments.open, data.commitments.relationships)}
            detail={text.all.commitmentsDetail(
              data.commitments.next
                ? {
                    title: data.commitments.next.title,
                    counterpart: data.commitments.next.counterpart,
                    date: shortDate(locale, data.commitments.next.dueDate),
                  }
                : null,
            )}
            renderLink={routerLink}
          />
        </RowGroup>
      )}
    </>
  );
}

/** Rechts: wie Reziproq sortiert, warum Platz 4 nicht im Fokus steht, was sonst hierher gehört */
function AllAside({ data }: { data: TodayAll }) {
  const text = useMessages(todayMessages);
  const title = useTopicTitle();
  const fourth = data.forYou.find((topic) => topic.rank === 4 && !topic.snoozed);
  return (
    <aside aria-label={text.all.more.label} className="flex min-w-0 flex-col gap-5.5">
      <section className="flex flex-col gap-3 rounded-lg bg-card p-5">
        <p className="flex items-center gap-2 font-semibold text-petrol-dark text-sm">
          <BrandMark />
          {text.all.sort.heading}
        </p>
        <p className="text-base leading-relaxed">{text.all.sort.text}</p>
      </section>
      {fourth && (
        <section className="flex flex-col gap-3 rounded-lg bg-card p-5">
          <h2 className="font-semibold text-input-border text-sm uppercase tracking-label">
            {text.all.whyNot.label}
          </h2>
          <p className="font-display font-semibold text-lg tracking-section">
            {text.all.whyNot.say(title(fourth))}
          </p>
          <p className="text-muted-strong text-sm leading-relaxed">{text.all.whyNot.text}</p>
        </section>
      )}
      <RowGroup label={text.all.more.label}>
        <Row title={text.all.more.done} detail={text.all.more.doneDetail(data.doneCount)} />
        <Row
          href="/einstellungen/anbindungen"
          title={text.all.more.arrivals}
          detail={text.all.more.arrivalsDetail}
          renderLink={routerLink}
        />
      </RowGroup>
    </aside>
  );
}

/**
 * Filter in einer Zeile über den Gruppen (Vorlage Heute-Alles): Alle, Beziehung, Warengruppe, Art,
 * Schwere, Frist. Ein Filter klappt seine Auswahl als Pillen in der Seite auf, ohne Überlagerung
 * (E-K0-01); die Wahl steht in der Adresse.
 */
function FilterBar({ data, filters }: { data: TodayAll; filters: TodayFilters }) {
  const text = useMessages(todayMessages);
  const navigate = useNavigate();
  const [open, setOpen] = useState<FilterKey | null>(null);
  const optionsId = useId();
  const active = filterKeys.some((key) => filters[key]);

  const set = (key: FilterKey | null, value?: string) => {
    const next: Record<string, string> = { ansicht: 'alles' };
    if (key) {
      for (const name of filterKeys) {
        const current = filters[name];
        if (current && name !== key) next[name] = current;
      }
      if (value && filters[key] !== value) next[key] = value;
    }
    setOpen(null);
    void navigate({ to: '/heute', search: next, replace: true });
  };

  const choices: Record<FilterKey, { value: string; label: string }[]> = {
    beziehung: data.relationships.map((entry) => ({ value: entry.id, label: entry.name })),
    warengruppe: data.materialGroups.map((name) => ({ value: name, label: name })),
    art: focusArts.map((art) => ({ value: art, label: text.arts[art] })),
    schwere: (['high', 'medium', 'low'] as const).map((value) => ({
      value,
      label: text.severity[value],
    })),
    frist: dueBuckets.map((bucket) => ({ value: bucket, label: text.buckets[bucket] })),
  };
  const names: Record<FilterKey, string> = {
    beziehung: text.all.filters.relationship,
    warengruppe: text.all.filters.materialGroup,
    art: text.all.filters.art,
    schwere: text.all.filters.severity,
    frist: text.all.filters.due,
  };
  const pill =
    'inline-flex min-h-11 items-center rounded-full px-3.5 font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

  return (
    <div className="flex flex-col gap-2">
      <fieldset className="flex min-w-0 flex-wrap gap-2">
        <legend className="sr-only">{text.all.filters.label}</legend>
        <button
          type="button"
          aria-pressed={!active}
          className={cn(
            pill,
            !active ? 'bg-ink text-on-dark' : 'bg-control text-ink hover:bg-line',
          )}
          onClick={() => set(null)}
        >
          {text.all.filters.all}
        </button>
        {filterKeys.map((key) => {
          const value = filters[key];
          const chosen = value ? choices[key].find((choice) => choice.value === value) : undefined;
          return (
            <button
              key={key}
              type="button"
              aria-expanded={open === key}
              aria-controls={open === key ? optionsId : undefined}
              className={cn(
                pill,
                value ? 'bg-ink text-on-dark' : 'bg-control text-ink hover:bg-line',
              )}
              onClick={() => setOpen(open === key ? null : key)}
            >
              {chosen ? text.all.filters.chosen(names[key], chosen.label) : names[key]}
            </button>
          );
        })}
      </fieldset>
      {open && (
        <fieldset id={optionsId} className="flex min-w-0 flex-wrap gap-2 rounded-md bg-card p-3">
          <legend className="sr-only">{text.all.filters.options(names[open])}</legend>
          {choices[open].map((choice) => (
            <button
              key={choice.value}
              type="button"
              aria-pressed={filters[open] === choice.value}
              className={cn(
                pill,
                filters[open] === choice.value
                  ? 'bg-ink text-on-dark'
                  : 'bg-control text-ink hover:bg-line',
              )}
              onClick={() => set(open, choice.value)}
            >
              {choice.label}
            </button>
          ))}
        </fieldset>
      )}
    </div>
  );
}
