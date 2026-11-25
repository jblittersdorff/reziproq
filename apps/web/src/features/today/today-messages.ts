import type { DueBucket, FocusArt, SummarySource } from '@reziproq/shared';
import { defineMessages } from '@/lib/i18n';

// HE-01 (K1-e): Texte für Heute mit den Ansichten Fokus und Alles.

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const join = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(' · ');

const artsDe: Record<FocusArt, string> = {
  wert: 'Wert',
  freigabe: 'Freigabe',
  unterschrift: 'Unterschrift',
  bewertung: 'Bewertung',
  feedback: 'Feedback',
  zusage: 'Zusage',
  aufgabe: 'Aufgabe',
  gespraech: 'Gespräch',
  hinweis: 'Hinweis',
  entscheidung: 'Entscheidung',
};
const artsEn: Record<FocusArt, string> = {
  wert: 'Value',
  freigabe: 'Approval',
  unterschrift: 'Signature',
  bewertung: 'Rating',
  feedback: 'Feedback',
  zusage: 'Commitment',
  aufgabe: 'Task',
  gespraech: 'Conversation',
  hinweis: 'Hint',
  entscheidung: 'Decision',
};

const sourcesDe: Record<SummarySource, string> = {
  hinweise: 'Hinweise',
  zusagen: 'Zusagen',
  termine: 'Termine',
  freigaben: 'Freigaben',
  bewertungen: 'Bewertungen',
  feedback: 'Feedback',
  kommentare: 'Kommentare',
  warengruppen: 'Warengruppen',
  entwuerfe: 'Entwürfe',
  erledigt: 'Erledigt',
};
const sourcesEn: Record<SummarySource, string> = {
  hinweise: 'Hints',
  zusagen: 'Commitments',
  termine: 'Meetings',
  freigaben: 'Approvals',
  bewertungen: 'Ratings',
  feedback: 'Feedback',
  kommentare: 'Comments',
  warengruppen: 'Categories',
  entwuerfe: 'Drafts',
  erledigt: 'Done',
};

const bucketsDe: Record<DueBucket, string> = {
  ueberfaellig: 'Überfällig',
  heute: 'Heute',
  woche: 'Diese Woche',
  spaeter: 'Später',
  ohne: 'Ohne Frist',
};
const bucketsEn: Record<DueBucket, string> = {
  ueberfaellig: 'Overdue',
  heute: 'Today',
  woche: 'This week',
  spaeter: 'Later',
  ohne: 'No deadline',
};

export const todayMessages = defineMessages({
  de: {
    title: 'Heute',
    loading: 'Heute wird geladen …',
    failed: 'Heute konnte nicht geladen werden.',
    retry: 'Erneut versuchen',
    where: (date: string, greeting: string) => `${date} · ${greeting}`,
    settings: 'Einstellungen',
    views: { label: 'Ansicht', focus: 'Fokus', all: 'Alles' },
    arts: artsDe,
    sources: sourcesDe,
    buckets: bucketsDe,
    severity: { high: 'hoch', medium: 'mittel', low: 'niedrig' },
    next: {
      kicker: (rank: number, total: number, counterpart: string | null) =>
        join('Als Nächstes', `Fokus ${rank} von ${total}`, counterpart),
      open: 'Öffnen',
      openLabel: (title: string) => `${title} öffnen`,
      snooze: 'Morgen erinnern',
      snoozeFailed: 'Das hat nicht geklappt. Bitte noch einmal versuchen.',
    },
    important: {
      label: 'Das Wichtigste',
      heading: 'Zusammengefasst von Reziproq',
    },
    review: {
      label: (count: number, minutes: number) =>
        join(
          'Kurz prüfen',
          `${count} ${plural(count, 'Entwurf', 'Entwürfe')}`,
          `ca. ${minutes} Min.`,
        ),
      chip: 'Entwurf',
      goThrough: 'Durchgehen',
      detail: (counterpart: string | null, time: string) => join(counterpart, time),
      phoneTitle: 'Kurz prüfen',
      phoneDetail: (count: number, minutes: number) =>
        `${count} ${plural(count, 'Entwurf', 'Entwürfe')} von Reziproq, ca. ${minutes} Min.`,
    },
    done: {
      title: (count: number) => `Erledigt im Hintergrund · ${count}`,
      tasks: (tasks: { task: string; count: number }[]) =>
        tasks.map((entry) => `${entry.task} ${entry.count}`).join(', '),
      none: 'Seit gestern 18:00 hat Reziproq nichts für dich erledigt.',
    },
    week: {
      label: 'Diese Woche',
      empty: 'Bis Sonntag steht sonst nichts an.',
      counterpartTurn: (owner: string) => `${owner} ist am Zug`,
    },
    waiting: {
      label: (count: number) => `Wartet auf andere · ${count}`,
      empty: 'Du wartest gerade auf niemanden.',
      due: (date: string) => `bis ${date}`,
      overdue: (days: number) =>
        days === 1 ? 'seit 1 Tag überfällig' : `seit ${days} Tagen überfällig`,
    },
    allRow: {
      title: 'Alles anzeigen',
      detail: (counts: { forYou: number; others: number; hints: number; commitments: number }) =>
        join(
          `${counts.forYou} für dich`,
          `${counts.others} bei anderen`,
          `${counts.hints} weitere ${plural(counts.hints, 'Hinweis', 'Hinweise')}`,
          `${counts.commitments} offene Zusagen und Aufgaben`,
        ),
    },
    all: {
      where:
        'Alles, was offen ist. Reziproq sortiert nach Wirkung und Frist, nichts wird ausgeblendet.',
      loading: 'Alles wird geladen …',
      failed: 'Die Ansicht Alles konnte nicht geladen werden.',
      filters: {
        label: 'Filter',
        all: 'Alle',
        relationship: 'Beziehung',
        materialGroup: 'Warengruppe',
        art: 'Art',
        severity: 'Schwere',
        due: 'Frist',
        chosen: (name: string, value: string) => `${name}: ${value}`,
        options: (name: string) => `Auswahl ${name}`,
        none: 'Nichts passt zu diesem Filter.',
      },
      groups: {
        forYou: (count: number) => `Für dich · ${count}`,
        drafts: (count: number) => `Entwürfe · ${count}`,
        others: (count: number) => `Bei anderen · ${count}`,
        hints: (count: number) => `Hinweise · ${count}`,
        assign: (count: number) => `Zuordnen · ${count}`,
        commitments: (count: number) => `Zusagen und Aufgaben · ${count}`,
      },
      forYouEmpty: 'Nichts braucht dich gerade.',
      chips: {
        focus: 'Fokus',
        next: 'rückt nach',
        overdue: 'überfällig',
        snoozed: 'morgen',
        inFocus: 'im Fokus',
        inReview: 'in Kurz prüfen',
      },
      topicDetail: (counterpart: string | null, art: string, severity: string | null) =>
        join(counterpart, severity ? `${art} ${severity}` : art),
      rank: (rank: number) => `Platz ${rank}`,
      draftsTitle: (count: number) =>
        `${count} ${plural(count, 'Entwurf', 'Entwürfe')} von Reziproq`,
      draftsDetail: (minutes: number) => `von Reziproq vorbereitet · ca. ${minutes} Minuten`,
      othersDetail: (owner: string, counterpart: string, when: string) =>
        join(owner && owner !== counterpart ? `${owner}, ${counterpart}` : counterpart, when),
      hintDetail: (supplier: string | null, rule: string, group: string | null, since: string) =>
        join(supplier, rule, group, `offen seit ${since}`),
      assignDetail: (when: string, suggestion: string | null) =>
        join(when, suggestion ? `Vorschlag: ${suggestion}` : 'ohne Vorschlag'),
      assignEvent: 'Ereignis ohne Lieferant',
      commitmentsTitle: (open: number, relationships: number) =>
        `${open} offene Zusagen und Aufgaben bei ${relationships} ${plural(relationships, 'Beziehung', 'Beziehungen')}`,
      commitmentsDetail: (next: { title: string; counterpart: string; date: string } | null) =>
        join(
          'je Beziehung in der Akte',
          next ? `nächste Frist: ${next.title}, ${next.counterpart}, ${next.date}` : null,
        ),
      footer:
        'Jeder Hinweis kommt aus einer festen Regel, Reziproq schreibt nur die Begründung. Verworfene Hinweise bleiben 90 Tage still, außer die Lage wird schlimmer.',
      sort: {
        heading: 'So sortiert Reziproq',
        text: 'Wirkung in Euro oder Schwere, dann Frist, dann Segment. Freigaben, Entscheidungen und Gespräche können in den Fokus, Entwürfe gehen in Kurz prüfen. Im Fokus stehen höchstens drei.',
      },
      whyNot: {
        label: 'Warum nicht im Fokus?',
        say: (title: string) => `„${title}“ steht auf Platz 4.`,
        text: 'Die drei Themen davor haben eine höhere Punktzahl aus Wirkung, Frist und Segment. Es rückt nach, sobald eines davon erledigt ist.',
      },
      more: {
        label: 'Was sonst noch hierher gehört',
        done: 'Erledigt im Hintergrund',
        doneDetail: (count: number) => `${count} seit gestern 18:00`,
        arrivals: 'Wie Termine ankommen',
        arrivalsDetail: 'Add-in, Eingangsadresse, Kalender',
      },
    },
  },
  en: {
    title: 'Today',
    loading: 'Loading today …',
    failed: 'Today could not be loaded.',
    retry: 'Try again',
    where: (date: string, greeting: string) => `${date} · ${greeting}`,
    settings: 'Settings',
    views: { label: 'View', focus: 'Focus', all: 'All' },
    arts: artsEn,
    sources: sourcesEn,
    buckets: bucketsEn,
    severity: { high: 'high', medium: 'medium', low: 'low' },
    next: {
      kicker: (rank: number, total: number, counterpart: string | null) =>
        join('Up next', `Focus ${rank} of ${total}`, counterpart),
      open: 'Open',
      openLabel: (title: string) => `Open ${title}`,
      snooze: 'Remind me tomorrow',
      snoozeFailed: 'That did not work. Please try again.',
    },
    important: {
      label: 'What matters',
      heading: 'Summarised by Reziproq',
    },
    review: {
      label: (count: number, minutes: number) =>
        join(
          'Quick review',
          `${count} ${plural(count, 'draft', 'drafts')}`,
          `about ${minutes} min`,
        ),
      chip: 'Draft',
      goThrough: 'Go through',
      detail: (counterpart: string | null, time: string) => join(counterpart, time),
      phoneTitle: 'Quick review',
      phoneDetail: (count: number, minutes: number) =>
        `${count} ${plural(count, 'draft', 'drafts')} by Reziproq, about ${minutes} min`,
    },
    done: {
      title: (count: number) => `Done in the background · ${count}`,
      tasks: (tasks: { task: string; count: number }[]) =>
        tasks.map((entry) => `${entry.task} ${entry.count}`).join(', '),
      none: 'Reziproq has not completed anything for you since 6 pm yesterday.',
    },
    week: {
      label: 'This week',
      empty: 'Nothing else is due until Sunday.',
      counterpartTurn: (owner: string) => `${owner} has to act`,
    },
    waiting: {
      label: (count: number) => `Waiting for others · ${count}`,
      empty: 'You are not waiting for anyone right now.',
      due: (date: string) => `by ${date}`,
      overdue: (days: number) => (days === 1 ? '1 day overdue' : `${days} days overdue`),
    },
    allRow: {
      title: 'Show all',
      detail: (counts: { forYou: number; others: number; hints: number; commitments: number }) =>
        join(
          `${counts.forYou} for you`,
          `${counts.others} with others`,
          `${counts.hints} more ${plural(counts.hints, 'hint', 'hints')}`,
          `${counts.commitments} open commitments and tasks`,
        ),
    },
    all: {
      where: 'Everything that is open. Reziproq sorts by impact and deadline, nothing is hidden.',
      loading: 'Loading everything …',
      failed: 'The view All could not be loaded.',
      filters: {
        label: 'Filters',
        all: 'All',
        relationship: 'Relationship',
        materialGroup: 'Category',
        art: 'Type',
        severity: 'Severity',
        due: 'Deadline',
        chosen: (name: string, value: string) => `${name}: ${value}`,
        options: (name: string) => `Choose ${name}`,
        none: 'Nothing matches this filter.',
      },
      groups: {
        forYou: (count: number) => `For you · ${count}`,
        drafts: (count: number) => `Drafts · ${count}`,
        others: (count: number) => `With others · ${count}`,
        hints: (count: number) => `Hints · ${count}`,
        assign: (count: number) => `To assign · ${count}`,
        commitments: (count: number) => `Commitments and tasks · ${count}`,
      },
      forYouEmpty: 'Nothing needs you right now.',
      chips: {
        focus: 'Focus',
        next: 'next up',
        overdue: 'overdue',
        snoozed: 'tomorrow',
        inFocus: 'in focus',
        inReview: 'in quick review',
      },
      topicDetail: (counterpart: string | null, art: string, severity: string | null) =>
        join(counterpart, severity ? `${art} ${severity}` : art),
      rank: (rank: number) => `Rank ${rank}`,
      draftsTitle: (count: number) => `${count} ${plural(count, 'draft', 'drafts')} by Reziproq`,
      draftsDetail: (minutes: number) => `prepared by Reziproq · about ${minutes} minutes`,
      othersDetail: (owner: string, counterpart: string, when: string) =>
        join(owner && owner !== counterpart ? `${owner}, ${counterpart}` : counterpart, when),
      hintDetail: (supplier: string | null, rule: string, group: string | null, since: string) =>
        join(supplier, rule, group, `open since ${since}`),
      assignDetail: (when: string, suggestion: string | null) =>
        join(when, suggestion ? `Suggestion: ${suggestion}` : 'no suggestion'),
      assignEvent: 'Event without supplier',
      commitmentsTitle: (open: number, relationships: number) =>
        `${open} open commitments and tasks with ${relationships} ${plural(relationships, 'relationship', 'relationships')}`,
      commitmentsDetail: (next: { title: string; counterpart: string; date: string } | null) =>
        join(
          'per relationship in its record',
          next ? `next deadline: ${next.title}, ${next.counterpart}, ${next.date}` : null,
        ),
      footer:
        'Every hint comes from a defined rule; Reziproq only writes the reasoning. Dismissed hints stay quiet for 90 days unless the situation gets worse.',
      sort: {
        heading: 'How Reziproq sorts',
        text: 'Impact in euros or severity, then deadline, then segment. Approvals, decisions and conversations can be in focus, drafts go to quick review. At most three are in focus.',
      },
      whyNot: {
        label: 'Why not in focus?',
        say: (title: string) => `“${title}” is in place 4.`,
        text: 'The three topics before it have a higher score from impact, deadline and segment. It moves up as soon as one of them is done.',
      },
      more: {
        label: 'What else belongs here',
        done: 'Done in the background',
        doneDetail: (count: number) => `${count} since 6 pm yesterday`,
        arrivals: 'How meetings arrive',
        arrivalsDetail: 'Add-in, inbound address, calendar',
      },
    },
  },
});
