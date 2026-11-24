import type { DueItem, NextAction, TimelineItem } from '@reziproq/shared';
import type { DateListItem, DateListTone } from '@/components/ui/date-list';
import { NextCard } from '@/components/ui/next-card';
import type { TimelineRailItem, TimelineTone } from '@/components/ui/timeline-rail';
import { routerLink } from '@/features/shell/navigation';
import { useLocale, useMessages, useT } from '@/lib/i18n';
import { dueTitle } from './due-title';
import { myDayMessages, type timelineMessages } from './my-day-messages';

type MyDayText = (typeof myDayMessages)['de'];
type TimelineText = (typeof timelineMessages)['de'];

/** Heutiges Datum in der Zeitzone des Browsers (JJJJ-MM-TT), nicht in UTC */
export function localToday(now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const weekdayOf = (locale: string, value: Date) =>
  new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(value).replace('.', '');

/** Kurzdatum mit Wochentag, z. B. „Mi 25.11.“ bzw. „Wed 11/25“ */
export function shortDate(locale: string, date: string) {
  const value = new Date(`${date}T12:00:00`);
  const day = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit' }).format(value);
  return `${weekdayOf(locale, value)} ${day}`;
}

/** Wochentag und Uhrzeit, z. B. „Fr 10:00“ */
export function weekdayTime(locale: string, iso: string) {
  const value = new Date(iso);
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
    value,
  );
  return `${weekdayOf(locale, value)} ${time}`;
}

/** Kurzzeile der Karte: „Als Nächstes · überfällig seit 2 Tagen · 2 Min.“ */
export function nextKicker(text: MyDayText, next: NextAction, locale: string) {
  const when =
    next.overdueDays > 0
      ? text.next.overdue(next.overdueDays)
      : next.overdueDays === 0
        ? text.next.today
        : text.next.until(shortDate(locale, next.item.dueDate));
  return [text.next.label, when, next.minutes ? text.next.minutes(next.minutes) : null]
    .filter(Boolean)
    .join(' · ');
}

/** Text des Knopfs je Art; sonst „Öffnen“ */
export function actionLabel(text: MyDayText, item: DueItem) {
  const labels = text.actions as Record<string, string>;
  return labels[item.kind] ?? text.actions.fallback;
}

/**
 * „Als Nächstes“ (NAV-10 Seitenregel 3): Tinte-Karte mit genau einem Knopf zum Ort der Aufgabe.
 * Ohne Kandidat erscheint keine Karte.
 */
export function NextActionCard({ next }: { next: NextAction | null | undefined }) {
  const t = useT();
  const text = useMessages(myDayMessages);
  const { locale } = useLocale();
  if (!next) return null;
  const item = next.item;
  const title = dueTitle(t, item);
  return (
    <NextCard
      kicker={nextKicker(text, next, locale)}
      title={title}
      text={item.supplier || undefined}
      action={{
        label: actionLabel(text, item),
        href: item.href,
        ariaLabel: t.start.openItem(item.supplier, title),
      }}
      renderLink={routerLink}
    />
  );
}

const tones: Record<TimelineItem['kind'], TimelineTone> = {
  meeting: 'meeting',
  deadline: 'deadline',
  approval: 'approval',
  commitment: 'commitment',
  risk: 'risk',
};

/** Ein Eintrag der Terminschiene: Art, Titel und Unterzeile aus den Daten */
export function timelineEntry(
  text: TimelineText,
  item: TimelineItem,
  locale: string,
): TimelineRailItem {
  const time = item.startsAt ? weekdayTime(locale, item.startsAt) : null;
  const base = { key: item.id, date: item.date, tone: tones[item.kind], href: item.href };
  switch (item.source) {
    case 'meeting':
      return {
        ...base,
        kind: text.kinds.meeting,
        title: item.title,
        sub: [time, item.counterpart, item.detail].filter(Boolean).join(' · '),
      };
    case 'commitment':
      return {
        ...base,
        kind: text.kinds.commitment,
        title: item.title,
        sub: [item.counterpart, item.detail ? text.commitmentBy(item.detail) : null]
          .filter(Boolean)
          .join(' · '),
      };
    case 'round':
      return {
        ...base,
        kind: text.kinds.deadline,
        title: text.round(item.title),
        sub: item.progress
          ? text.roundProgress(item.progress.done, item.progress.total)
          : undefined,
      };
    case 'category_review':
      return { ...base, kind: text.kinds.meeting, title: text.review(item.title) };
    default:
      return {
        ...base,
        kind: text.kinds[item.kind],
        title: item.title,
        sub: item.counterpart ?? undefined,
      };
  }
}

const chipTones: Record<TimelineItem['kind'], DateListTone> = {
  meeting: 'shared',
  deadline: 'warning',
  approval: 'success',
  commitment: 'neutral',
  risk: 'danger',
};

/** Ein Eintrag aus `timeline_item` als Zeile mit Datumskreis und Art als Chip (Mein Tag, Lieferant) */
export function timelineDateItem(
  text: TimelineText,
  item: TimelineItem,
  locale: string,
): DateListItem {
  const entry = timelineEntry(text, item, locale);
  return {
    key: entry.key,
    date: entry.date,
    title: entry.title,
    sub: entry.sub,
    chip: { label: entry.kind, tone: chipTones[item.kind] ?? 'neutral' },
    ...(entry.href ? { href: entry.href } : {}),
  };
}
