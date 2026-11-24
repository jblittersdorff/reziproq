import { type DueItem, daysBetween, endOfWeek, type WaitingItem } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { BackLink } from '@/components/ui/back-link';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { AreaSwitch } from '@/components/ui/entity-header';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { PageTitle } from '@/components/ui/page-title';
import { Row, RowGroup } from '@/components/ui/row-group';
import { routerLink } from '@/features/shell/navigation';
import { useDocumentTitle } from '@/features/shell/page-header';
import { dueQueryOptions, myActionsQueryOptions, myDayQueryOptions } from '@/lib/api';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { dueTitle } from './due-title';
import { myDayMessages } from './my-day-messages';
import { localToday, NextActionCard, shortDate } from './next-action';

/**
 * Alle Aufgaben (NAV-10 1.1, Vorlage `Aufgaben.dc.html`): Zurück zu Mein Tag, drei Ansichten
 * („Für mich“, „Wartet auf andere“, „Maßnahmen“), oben „Als Nächstes“, darunter die Aufgaben nach
 * Überfällig, Heute, Diese Woche und Später. Speichert nichts; jede Zeile führt zum Ort der Sache.
 */
export function DuePage({ view = 'mine' }: { view?: 'mine' | 'waiting' }) {
  const t = useT();
  const text = useMessages(myDayMessages);
  const tasks = text.tasks;
  const { locale } = useLocale();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const enabled = accessToken !== '';
  const due = useQuery({ ...dueQueryOptions(accessToken), enabled });
  const myDay = useQuery({ ...myDayQueryOptions(accessToken), enabled }).data;
  const actions = useQuery({ ...myActionsQueryOptions(accessToken), enabled }).data;
  useDocumentTitle(tasks.title);

  const today = myDay?.today ?? localToday();
  const items = due.data?.items ?? [];
  const waiting = myDay?.waiting ?? [];
  const header = (
    <>
      <PageTitle
        back={<BackLink label={text.title} href="/heute" renderLink={routerLink} />}
        title={tasks.title}
        where={tasks.where}
      />
      <AreaSwitch
        label={tasks.views}
        active={view}
        renderLink={routerLink}
        areas={[
          { key: 'mine', label: tasks.mine(items.length), href: '/start/faellig' },
          {
            key: 'waiting',
            label: tasks.waiting(myDay?.waitingTotal ?? 0),
            href: '/start/faellig?ansicht=wartet',
          },
          {
            key: 'actions',
            label: actions ? tasks.actionsCount(actions.items.length) : tasks.actions,
            href: '/start/massnahmen',
          },
        ]}
      />
    </>
  );

  if (due.isError) {
    return (
      <>
        {header}
        <ErrorState title={t.start.failed} />
      </>
    );
  }
  if (!due.data) {
    return (
      <>
        {header}
        <LoadingState label={t.start.loading} />
      </>
    );
  }

  if (view === 'waiting') {
    return (
      <>
        {header}
        {waiting.length === 0 ? (
          <EmptyState title={tasks.waitingEmpty} description={tasks.where} />
        ) : (
          <RowGroup label={tasks.waiting(waiting.length)}>
            {waiting.map((item) => (
              <WaitingRow key={item.id} item={item} today={today} />
            ))}
          </RowGroup>
        )}
      </>
    );
  }

  const next = myDay?.next ?? null;
  const rest = items.filter((item) => item.id !== next?.item.id);
  const sunday = endOfWeek(today);
  const groups: { key: string; label: (n: number) => string; items: DueItem[] }[] = [
    { key: 'overdue', label: tasks.overdue, items: rest.filter((item) => item.dueDate < today) },
    { key: 'today', label: tasks.today, items: rest.filter((item) => item.dueDate === today) },
    {
      key: 'week',
      label: tasks.week,
      items: rest.filter((item) => item.dueDate <= sunday && item.dueDate > today),
    },
    { key: 'later', label: tasks.later, items: rest.filter((item) => item.dueDate > sunday) },
  ];

  const chip = (item: DueItem) => {
    const late = daysBetween(item.dueDate, today);
    if (late > 0) return <Badge variant="danger">{tasks.since(late)}</Badge>;
    if (late === 0) return <Badge variant="warning">{tasks.todayChip}</Badge>;
    return <Badge>{shortDate(locale, item.dueDate)}</Badge>;
  };

  return (
    <>
      {header}
      {items.length === 0 ? (
        <EmptyState title={t.start.dueEmpty} description={t.start.dueEmptyHint} />
      ) : (
        <>
          <NextActionCard next={next} />
          {groups
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <RowGroup key={group.key} label={group.label(group.items.length)}>
                {group.items.map((item) => (
                  <Row
                    key={item.id}
                    href={item.href}
                    lead={<Monogram name={item.supplier || dueTitle(t, item)} />}
                    title={dueTitle(t, item)}
                    detail={item.supplier || undefined}
                    value={chip(item)}
                    renderLink={routerLink}
                  />
                ))}
              </RowGroup>
            ))}
        </>
      )}
    </>
  );
}

function WaitingRow({ item, today }: { item: WaitingItem; today: string }) {
  const tasks = useMessages(myDayMessages).tasks;
  const { locale } = useLocale();
  const late = daysBetween(item.dueDate, today);
  return (
    <Row
      href={item.href}
      lead={<Monogram name={item.counterpart || item.owner} />}
      title={item.title}
      detail={[item.owner, item.counterpart].filter(Boolean).join(' · ')}
      value={
        late > 0 ? (
          <Badge variant="danger">{tasks.since(late)}</Badge>
        ) : (
          <Badge>{shortDate(locale, item.dueDate)}</Badge>
        )
      }
      renderLink={routerLink}
    />
  );
}
