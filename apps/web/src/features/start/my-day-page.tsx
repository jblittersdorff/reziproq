import type { DueItem, PreparedDraft } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import type * as React from 'react';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { ChartCard } from '@/components/ui/chart-card';
import { DateList } from '@/components/ui/date-list';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { MeterBar } from '@/components/ui/meter-bar';
import { Monogram } from '@/components/ui/monogram';
import { PageTitle } from '@/components/ui/page-title';
import { Row, RowGroup } from '@/components/ui/row-group';
import { useMe } from '@/features/auth/use-me';
import { useCan } from '@/features/auth/use-permissions';
import { kindOf } from '@/features/calendar/inbox-page';
import { routerLink } from '@/features/shell/navigation';
import { useDocumentTitle } from '@/features/shell/page-header';
import { inboxQueryOptions, myDayQueryOptions } from '@/lib/api';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { dueTitle } from './due-title';
import { dayTime } from './greeting';
import { myDayMessages, timelineMessages } from './my-day-messages';
import { NextActionCard, shortDate, timelineDateItem, weekdayTime } from './next-action';

function preparedTitle(text: (typeof myDayMessages)['de'], draft: PreparedDraft) {
  const kinds = text.preparedKinds;
  if (draft.kind.startsWith('brief_')) return kinds.brief(draft.subject);
  if (draft.kind.startsWith('capture_')) return kinds.capture(draft.subject);
  if (draft.kind.startsWith('qbr_')) return kinds.qbr(draft.subject);
  if (draft.kind === 'pre_read') return kinds.pre_read(draft.subject);
  const byKind = kinds as unknown as Record<string, unknown>;
  const value = byKind[draft.kind];
  return typeof value === 'string' ? value : kinds.fallback;
}

/**
 * Mein Tag (NAV-10 1.1, Vorlagen `Main.dc.html`, `A-MeinTag.dc.html`): Kopf mit „n von m für heute
 * erledigt“; links „Als Nächstes“, Heute, Von Reziproq vorbereitet, Diese Woche und der Link zu
 * allen Aufgaben; rechts Termine und Fristen, Wartet auf andere, Neu eingegangen und Hinweise.
 * Auf dem Telefon kommt die rechte Spalte nach „Heute“. Speichert nichts.
 */
export function MyDayPage() {
  const t = useT();
  const text = useMessages(myDayMessages);
  const rail = useMessages(timelineMessages);
  const { locale } = useLocale();
  const me = useMe();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({ ...myDayQueryOptions(accessToken), enabled: accessToken !== '' });
  const canMeetings = useCan('termine.sehen');
  const inbox = useQuery({
    ...inboxQueryOptions(accessToken),
    enabled: accessToken !== '' && canMeetings,
  }).data;
  useDocumentTitle(text.title);

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
  const data = query.data;
  const where = text.where(
    date,
    me.data ? greeting(me.data.firstName) : t.start.greetingWithoutName,
  );

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

  if (query.isError) {
    return (
      <>
        <PageTitle title={text.title} where={where} aside={person} />
        <ErrorState title={text.failed} />
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageTitle title={text.title} where={where} aside={person} />
        <LoadingState label={text.loading} />
      </>
    );
  }

  const openToday = data.todayItems.length + (data.next && data.next.overdueDays >= 0 ? 1 : 0);
  const planned = data.doneToday + openToday;
  const progress = planned > 0 && (
    <div className="flex items-center gap-2.5 text-muted-foreground text-sm">
      <span>{text.progress(data.doneToday, planned)}</span>
      <MeterBar
        className="w-35"
        value={data.doneToday / planned}
        label={text.progress(data.doneToday, planned)}
      />
    </div>
  );

  const dueRow = (item: DueItem, value?: React.ReactNode) => (
    <Row
      key={item.id}
      href={item.href}
      lead={<Monogram name={item.supplier || dueTitle(t, item)} />}
      title={dueTitle(t, item)}
      detail={item.supplier || undefined}
      value={value}
      renderLink={routerLink}
    />
  );

  return (
    <>
      <PageTitle
        title={text.title}
        where={where}
        aside={
          (progress || person) && (
            <div className="flex items-center gap-3">
              {progress}
              {person}
            </div>
          )
        }
      />
      <div className="grid gap-5.5 wide:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] wide:grid-rows-[auto_1fr]">
        <div className="flex min-w-0 flex-col gap-5.5 wide:col-start-1 wide:row-start-1">
          <NextActionCard next={data.next} />
          {data.todayItems.length > 0 ? (
            <RowGroup label={text.todayMore(data.todayItems.length)}>
              {data.todayItems.map((item) => dueRow(item))}
            </RowGroup>
          ) : (
            !data.next && (
              <RowGroup label={text.today}>
                <Row title={text.empty} />
              </RowGroup>
            )
          )}
        </div>
        <aside
          aria-label={text.timelineTitle}
          className="flex min-w-0 flex-col gap-5.5 wide:col-start-2 wide:row-span-2 wide:row-start-1"
        >
          <ChartCard label={text.timelineKicker} title={text.timelineTitle}>
            {data.timeline.length > 0 ? (
              <DateList
                locale={locale}
                renderLink={routerLink}
                items={data.timeline.map((item) => timelineDateItem(rail, item, locale))}
              />
            ) : (
              <p className="text-muted-foreground">{text.timelineEmpty}</p>
            )}
          </ChartCard>
          <ChartCard label={text.waitingKicker(data.waitingTotal)} title={text.waitingTitle}>
            {data.waiting.length > 0 ? (
              <DateList
                locale={locale}
                renderLink={routerLink}
                items={data.waiting.slice(0, 6).map((item) => ({
                  key: item.id,
                  title: item.title,
                  sub: [item.owner, item.counterpart].filter(Boolean).join(' · '),
                  chip:
                    item.dueDate < data.today
                      ? { label: text.overdue, tone: 'danger' }
                      : { label: shortDate(locale, item.dueDate), tone: 'neutral' },
                  href: item.href,
                }))}
              />
            ) : (
              <p className="text-muted-foreground">{text.waitingEmpty}</p>
            )}
          </ChartCard>
          {(inbox?.active || data.hints) && (
            <RowGroup>
              {inbox?.active && (
                <Row
                  href="/mein-tag/eingang"
                  title={text.inbox}
                  detail={
                    inbox.open.length > 0
                      ? t.inbox.tileCount(inbox.open.length, kindOf(inbox.open))
                      : t.inbox.tileEmpty
                  }
                  value={
                    inbox.open.length > 0 ? (
                      <Badge variant="shared">{inbox.open.length}</Badge>
                    ) : undefined
                  }
                  renderLink={routerLink}
                />
              )}
              {data.hints && (
                <Row
                  href="/hinweise"
                  title={text.hints}
                  detail={text.hintsDetail(data.hints.open, data.hints.high)}
                  renderLink={routerLink}
                />
              )}
            </RowGroup>
          )}
        </aside>
        <div className="flex min-w-0 flex-col gap-5.5 wide:col-start-1 wide:row-start-2">
          {data.prepared.length > 0 && (
            <RowGroup label={text.prepared(data.preparedTotal)}>
              {data.prepared.map((draft) => (
                <Row
                  key={draft.id}
                  href={draft.href}
                  lead={<Monogram name="Reziproq" label={text.rz} tone="ink" />}
                  title={preparedTitle(text, draft)}
                  detail={text.preparedDetail(
                    draft.counterpart,
                    weekdayTime(locale, draft.createdAt),
                  )}
                  renderLink={routerLink}
                />
              ))}
            </RowGroup>
          )}
          {data.week.length > 0 && (
            <RowGroup label={text.week(data.week.length)}>
              {data.week.map((item) =>
                dueRow(item, <Badge>{shortDate(locale, item.dueDate)}</Badge>),
              )}
            </RowGroup>
          )}
          {data.total > 0 &&
            routerLink({
              href: '/start/faellig',
              className:
                'flex min-h-11 items-center justify-center rounded-full font-semibold text-base text-petrol no-underline hover:text-petrol-dark',
              children: text.all(data.total),
            })}
        </div>
      </div>
    </>
  );
}
