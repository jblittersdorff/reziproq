import { defineMessages } from '@/lib/i18n';

// HE-01 Erledigt im Hintergrund (K1-e.3, Vorlage Erledigt)

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const join = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(' · ');

const tasksDe: Record<string, string> = {
  inbox: 'Postfach',
  commitment_followup: 'Zusagen nachhalten',
  meeting_brief: 'Termin-Briefing',
  meeting_capture: 'Ergebnisse nach dem Termin',
  deck_build: 'Deck bauen',
  import_assign: 'Import zuordnen',
  rating_prefill: 'Bewertung vorausfüllen',
  feedback: 'Feedback',
  segment_suggest: 'Segment vorschlagen',
  early_warning: 'Frühwarnung',
  value_finder: 'Wertfinder',
};
const tasksEn: Record<string, string> = {
  inbox: 'Inbox',
  commitment_followup: 'Commitment follow-up',
  meeting_brief: 'Meeting briefing',
  meeting_capture: 'Meeting outcomes',
  deck_build: 'Build deck',
  import_assign: 'Import assignment',
  rating_prefill: 'Prefill ratings',
  feedback: 'Feedback',
  segment_suggest: 'Suggest segment',
  early_warning: 'Early warning',
  value_finder: 'Value finder',
};

export const doneMessages = defineMessages({
  de: {
    title: 'Erledigt im Hintergrund',
    back: 'Heute',
    where: (count: number) =>
      join(
        `${count} ${plural(count, 'Vorgang', 'Vorgänge')} seit gestern 18:00`,
        'alles nachlesbar, vieles mit einem Klick zurückzunehmen',
      ),
    loading: 'Erledigt wird geladen …',
    failed: 'Erledigt konnte nicht geladen werden.',
    retry: 'Erneut versuchen',
    summaryHeading: 'Zusammengefasst von Reziproq',
    summary: (count: number) =>
      count === 0
        ? 'Seit gestern 18:00 hat Reziproq nichts für dich erledigt.'
        : `${count} ${plural(count, 'Vorgang', 'Vorgänge')} erledigt, nichts davon verbindlich gegenüber Lieferanten.`,
    chips: {
      inbound_assign: (n: number) => `${n} ${plural(n, 'Termin', 'Termine')} zugeordnet`,
      prepared: (n: number) => `${n} ${plural(n, 'Entwurf', 'Entwürfe')} vorbereitet`,
      run: (n: number) => `${n} ${plural(n, 'Lauf', 'Läufe')}`,
      failed: (n: number) => `${n} fehlgeschlagen`,
    },
    filter: 'Aufgabe',
    all: 'Alle',
    tasks: tasksDe,
    today: 'Heute',
    yesterday: 'Gestern',
    text: {
      inbound_assign: (subject: string | null, counterpart: string | null) =>
        counterpart
          ? `Termin „${subject ?? ''}“ der Beziehung ${counterpart} zugeordnet`
          : `Termin „${subject ?? ''}“ zugeordnet`,
      prepared: (what: string, open: boolean) =>
        open ? `${what} vorbereitet, wartet in Kurz prüfen` : `${what} vorbereitet`,
      run: (what: string) => `${what} ausgeführt`,
      failed: (what: string) => `${what} fehlgeschlagen`,
    },
    detail: (task: string, counterpart: string | null) => join(task, counterpart),
    undo: 'Zurücknehmen',
    view: 'Ansehen',
    why: 'Warum',
    undone: 'zurückgenommen',
    failedChip: 'fehlgeschlagen',
    blocked: {
      geaendert: 'Seitdem geändert, Rücknahme nicht möglich',
      abgelaufen: 'Älter als 30 Tage, Rücknahme nicht möglich',
    },
    changedBy: (name: string) => `Seitdem geändert von ${name}, Rücknahme nicht möglich`,
    undoFailed: 'Das hat nicht geklappt. Bitte noch einmal versuchen.',
    empty: 'In den letzten 30 Tagen hat Reziproq nichts für dich erledigt.',
    levelsLabel: 'So arbeitet Reziproq für dich',
    levels: {
      do: 'erledigt selbst',
      prepare: 'bereitet vor',
      suggest: 'schlägt vor',
    },
    levelChips: { do: 'Erledigen', prepare: 'Vorbereiten', suggest: 'Vorschlagen' },
    change: 'In Mein Agent ändern',
    never: {
      title: 'Nie automatisch',
      text: 'Zusagen im Namen deiner Seite, Freigaben, Bestätigung von Wert und alles, was Privates in geteilte Bereiche bringt.',
    },
  },
  en: {
    title: 'Done in the background',
    back: 'Today',
    where: (count: number) =>
      join(
        `${count} ${plural(count, 'task', 'tasks')} since 6 pm yesterday`,
        'everything traceable, much of it undoable with one click',
      ),
    loading: 'Loading done tasks …',
    failed: 'Done tasks could not be loaded.',
    retry: 'Try again',
    summaryHeading: 'Summarised by Reziproq',
    summary: (count: number) =>
      count === 0
        ? 'Reziproq has not completed anything for you since 6 pm yesterday.'
        : `${count} ${plural(count, 'task', 'tasks')} done, none of them binding towards suppliers.`,
    chips: {
      inbound_assign: (n: number) => `${n} ${plural(n, 'meeting', 'meetings')} assigned`,
      prepared: (n: number) => `${n} ${plural(n, 'draft', 'drafts')} prepared`,
      run: (n: number) => `${n} ${plural(n, 'run', 'runs')}`,
      failed: (n: number) => `${n} failed`,
    },
    filter: 'Task',
    all: 'All',
    tasks: tasksEn,
    today: 'Today',
    yesterday: 'Yesterday',
    text: {
      inbound_assign: (subject: string | null, counterpart: string | null) =>
        counterpart
          ? `Meeting “${subject ?? ''}” assigned to ${counterpart}`
          : `Meeting “${subject ?? ''}” assigned`,
      prepared: (what: string, open: boolean) =>
        open ? `${what} prepared, waiting in quick review` : `${what} prepared`,
      run: (what: string) => `${what} completed`,
      failed: (what: string) => `${what} failed`,
    },
    detail: (task: string, counterpart: string | null) => join(task, counterpart),
    undo: 'Undo',
    view: 'View',
    why: 'Why',
    undone: 'undone',
    failedChip: 'failed',
    blocked: {
      geaendert: 'Changed since, cannot be undone',
      abgelaufen: 'Older than 30 days, cannot be undone',
    },
    changedBy: (name: string) => `Changed since by ${name}, cannot be undone`,
    undoFailed: 'That did not work. Please try again.',
    empty: 'Reziproq has not completed anything for you in the last 30 days.',
    levelsLabel: 'How Reziproq works for you',
    levels: {
      do: 'does it itself',
      prepare: 'prepares',
      suggest: 'suggests',
    },
    levelChips: { do: 'Do', prepare: 'Prepare', suggest: 'Suggest' },
    change: 'Change in My agent',
    never: {
      title: 'Never automatic',
      text: 'Commitments on behalf of your side, approvals, value confirmations and anything that brings private content into shared areas.',
    },
  },
});
