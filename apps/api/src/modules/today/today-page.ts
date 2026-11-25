import {
  type AllTopic,
  type AllWaiting,
  endOfWeek,
  type FocusArt,
  type FocusTopic,
  maxWaitingRows,
  maxWeekEntries,
  type SentenceFact,
  type SummarySource,
  type WaitingItem,
  type WeekEntry,
} from '@reziproq/shared';
import type { Locale } from './triage.js';

// HE-01 Aufbau (K1-e): Regeln der Seite Heute ohne Datenbank. „Das Wichtigste“ als Satz aus einer
// Vorlage mit belegten Zahlen (G-6), „Diese Woche“ und „Wartet auf andere“ ohne doppelte Zeilen,
// Quellen-Chips aus den gezeigten Themen.

/** Zusammenfassung „Das Wichtigste“: ein Satz, jede Zahl als Fakt mit Herkunft */
export function summarySentence(
  locale: Locale,
  input: { done: number; more: number; hasNext: boolean },
): { sentence: string; facts: SentenceFact[] } {
  const de = locale === 'de';
  const facts: SentenceFact[] = [];
  const parts: string[] = [];
  if (input.done > 0) {
    facts.push({
      key: 'done_since_yesterday',
      value: input.done,
      source: { objectType: 'focus_item', label: de ? 'Erledigt' : 'Done' },
    });
    parts.push(
      de
        ? input.done === 1
          ? 'Reziproq hat seit gestern 1 Vorgang erledigt.'
          : `Reziproq hat seit gestern ${input.done} Vorgänge erledigt.`
        : input.done === 1
          ? 'Reziproq has completed 1 task since yesterday.'
          : `Reziproq has completed ${input.done} tasks since yesterday.`,
    );
  }
  if (input.more > 0) {
    facts.push({
      key: 'more_topics',
      value: input.more,
      source: { objectType: 'focus_item', label: de ? 'Fokus' : 'Focus' },
    });
    parts.push(
      de
        ? input.more === 1
          ? '1 weiteres Thema braucht dich.'
          : `${input.more} weitere Themen brauchen dich.`
        : input.more === 1
          ? '1 more topic needs you.'
          : `${input.more} more topics need you.`,
    );
  } else {
    parts.push(
      input.hasNext
        ? de
          ? 'Sonst braucht dich gerade nichts.'
          : 'Nothing else needs you right now.'
        : de
          ? 'Nichts braucht dich gerade.'
          : 'Nothing needs you right now.',
    );
  }
  return { sentence: parts.join(' '), facts };
}

/** Vorlage ohne Zahl für „Das Wichtigste“, falls ein Satz eine unbelegte Zahl hätte */
export const summaryTemplate = (locale: Locale) =>
  locale === 'de' ? 'Hier steht, was dich heute braucht.' : 'Here is what needs you today.';

const artSources: Record<FocusArt, SummarySource> = {
  wert: 'freigaben',
  freigabe: 'freigaben',
  unterschrift: 'freigaben',
  bewertung: 'bewertungen',
  feedback: 'feedback',
  zusage: 'zusagen',
  aufgabe: 'zusagen',
  gespraech: 'kommentare',
  hinweis: 'hinweise',
  entscheidung: 'termine',
};

/** Quellen-Chips: woher die gezeigten Themen kommen, in der Reihenfolge der Themen */
export function summarySources(
  topics: Pick<FocusTopic, 'art' | 'item'>[],
  input: { drafts: number; done: number },
): SummarySource[] {
  const sources = new Set<SummarySource>();
  for (const topic of topics) {
    const kind = topic.item?.kind;
    sources.add(
      kind === 'strategy' ||
        kind === 'view_assignment' ||
        kind === 'category_review' ||
        kind === 'category_approval' ||
        kind === 'category_conflict'
        ? 'warengruppen'
        : artSources[topic.art],
    );
  }
  if (input.drafts > 0) sources.add('entwuerfe');
  if (input.done > 0) sources.add('erledigt');
  return [...sources];
}

/**
 * „Diese Woche“ (E-K1-4): eigene Fristen nach heute bis Sonntag, die nicht schon im Fokus stehen,
 * und Fristen, bei denen das Gegenüber am Zug ist; nach Datum, eigene zuerst, höchstens drei.
 * „Wartet auf andere“ zeigt danach nur, was nicht schon in „Diese Woche“ steht.
 */
export function weekAndWaiting(
  today: string,
  topics: AllTopic[],
  waiting: AllWaiting[],
): { week: WeekEntry[]; waiting: WaitingItem[] } {
  const sunday = endOfWeek(today);
  const inWeek = (date: string | null): date is string =>
    date !== null && date > today && date <= sunday;
  const own: WeekEntry[] = topics
    .filter((topic) => !topic.snoozed && topic.rank > 3 && inWeek(topic.dueDate))
    .map((topic) => ({ turn: 'own', date: topic.dueDate as string, topic: plain(topic) }));
  const theirs: WeekEntry[] = waiting
    .filter((item) => !item.inFocus && inWeek(item.dueDate))
    .map((item) => ({ turn: 'counterpart', date: item.dueDate, waiting: plainWaiting(item) }));
  const week = [...own, ...theirs]
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        (a.turn === b.turn ? 0 : a.turn === 'own' ? -1 : 1) ||
        (a.turn === 'own' && b.turn === 'own' ? b.topic.score - a.topic.score : 0),
    )
    .slice(0, maxWeekEntries);
  const shown = new Set(
    week.flatMap((entry) => (entry.turn === 'counterpart' ? [entry.waiting.id] : [])),
  );
  return {
    week,
    waiting: waiting
      .filter((item) => !shown.has(item.id))
      .slice(0, maxWaitingRows)
      .map(plainWaiting),
  };
}

/** Fokus-Thema ohne die Felder der Ansicht Alles */
function plain(topic: AllTopic): FocusTopic {
  const { rank: _rank, snoozed: _snoozed, ...rest } = topic;
  return rest;
}

function plainWaiting(item: AllWaiting): WaitingItem {
  const { relationshipId: _r, materialGroup: _m, inFocus: _f, ...rest } = item;
  return rest;
}

/** Erste UUID in einer zusammengesetzten ID wie „commitment:<uuid>“ */
export function uuidIn(value: string): string | null {
  return /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.exec(value)?.[0] ?? null;
}
