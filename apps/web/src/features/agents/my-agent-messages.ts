import type { WorkerLevel } from '@reziproq/shared';
import { defineMessages } from '@/lib/i18n';

// MA-01 Mein Agent (K1-f.3, Vorlage Mein-Agent)

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const join = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(' · ');

type TaskText = { name: string; does: string };

export const myAgentMessages = defineMessages({
  de: {
    title: 'Mein Agent',
    where: 'Was Reziproq für dich erledigt, vorbereitet oder vorschlägt. Gilt nur für dich.',
    loading: 'Mein Agent wird geladen …',
    failed: 'Mein Agent konnte nicht geladen werden.',
    retry: 'Erneut versuchen',
    summaryHeading: 'Zusammengefasst von Reziproq',
    week: (done: number, prepared: number) =>
      `Diese Woche hat Reziproq ${done} ${plural(done, 'Vorgang', 'Vorgänge')} erledigt und ${prepared} ${plural(prepared, 'Entwurf', 'Entwürfe')} vorbereitet.`,
    adoption: (percent: number) =>
      `In den letzten acht Wochen hast du ${percent} % unverändert übernommen.`,
    adoptionNone: 'In den letzten acht Wochen hast du noch keinen Entwurf entschieden.',
    tasksLabel: 'Aufgaben von Reziproq',
    switchLabel: (task: string) => `Wie viel Reziproq bei „${task}“ selbst tut`,
    levels: { suggest: 'Vorschlagen', prepare: 'Vorbereiten', do: 'Erledigen' } as Record<
      WorkerLevel,
      string
    >,
    tasks: {
      inbox: { name: 'Postfach', does: 'Termine und Mails den Beziehungen zuordnen' },
      // ZQ-01 Regel 5 (K2-b.6): erinnern wirkt; als gehalten buchen kommt mit seinem Paket
      commitment_followup: {
        name: 'Zusagen nachhalten',
        does: 'Lieferanten an fällige Zusagen erinnern, als Nachricht von Reziproq',
      },
      meeting_brief: {
        name: 'Termin-Briefing',
        does: 'vor wichtigen Terminen, Vorlauf je Termintyp',
      },
      meeting_capture: {
        name: 'Ergebnisse nach dem Termin',
        does: 'Zusagen, Aufgaben und Fragen aus den Notizen',
      },
      import_assign: { name: 'Import', does: 'Spend und Lieferanten zuordnen' },
      early_warning: {
        name: 'Frühwarnung',
        does: 'Hinweise mit Begründung, hohe Wirkung kommt in den Fokus',
      },
      value_finder: { name: 'Wertfinder', does: 'Wertpotenziale, monatlich für Fokuslieferanten' },
      market_signals: {
        name: 'Marktsignale',
        does: 'Signale aus öffentlichen Quellen auf Beziehungen abbilden',
      },
    } as Record<string, TaskText>,
    detail: join,
    unchanged: (unchanged: number, decided: number) => `${unchanged} von ${decided} unverändert`,
    off: 'in den KI-Einstellungen aus',
    capped: (level: string) => `höchstens ${level}, festgelegt von Admins`,
    later: (levels: string[]) =>
      `${levels.join(' und ')} ${levels.length === 1 ? 'folgt' : 'folgen'}`,
    saveFailed: 'Die Stufe konnte nicht gespeichert werden. Bitte noch einmal versuchen.',
    explain:
      'Vorschlagen: ein Hinweis mit Begründung. Vorbereiten: ein fertiger Entwurf in Kurz prüfen. Erledigen: Reziproq handelt und meldet es unter Erledigt, mit einem Klick zurückzunehmen.',
    readOnly: 'Als Leser siehst du die Stufen, änderst sie aber nicht.',
    never: {
      title: 'Nie automatisch, auf keiner Stufe',
      items: [
        'Zusagen im Namen deiner Seite',
        'Freigaben',
        'Bestätigung von Wert',
        'Privates in geteilte Bereiche',
        'Deal senden oder bestätigen',
        'Mandat ändern',
      ],
    },
    whoLabel: 'Wer sieht was',
    who: {
      own: 'Deine Einstellungen',
      ownDetail: 'gelten nur für dich',
      admin: 'Budget, EU-Verarbeitung, Recherche',
      adminDetail: 'legen Admins fest',
      log: 'Protokoll',
      logDetail: 'alles Erledigte nachlesen',
    },
  },
  en: {
    title: 'My agent',
    where: 'What Reziproq does, prepares or suggests for you. Applies only to you.',
    loading: 'Loading my agent …',
    failed: 'My agent could not be loaded.',
    retry: 'Try again',
    summaryHeading: 'Summarised by Reziproq',
    week: (done: number, prepared: number) =>
      `This week Reziproq completed ${done} ${plural(done, 'task', 'tasks')} and prepared ${prepared} ${plural(prepared, 'draft', 'drafts')}.`,
    adoption: (percent: number) => `In the last eight weeks you adopted ${percent} % unchanged.`,
    adoptionNone: 'You have not decided any draft in the last eight weeks.',
    tasksLabel: 'Tasks of Reziproq',
    switchLabel: (task: string) => `How much Reziproq does itself for “${task}”`,
    levels: { suggest: 'Suggest', prepare: 'Prepare', do: 'Do' } as Record<WorkerLevel, string>,
    tasks: {
      inbox: { name: 'Inbox', does: 'Assign meetings and mails to relationships' },
      commitment_followup: {
        name: 'Commitment follow-up',
        does: 'Remind suppliers of due commitments, as a message from Reziproq',
      },
      meeting_brief: {
        name: 'Meeting briefing',
        does: 'before important meetings, lead time per meeting type',
      },
      meeting_capture: {
        name: 'Meeting outcomes',
        does: 'Commitments, tasks and questions from the notes',
      },
      import_assign: { name: 'Import', does: 'Assign spend and suppliers' },
      early_warning: {
        name: 'Early warning',
        does: 'Hints with reasons; high impact comes into focus',
      },
      value_finder: { name: 'Value finder', does: 'Value potentials, monthly for focus suppliers' },
      market_signals: {
        name: 'Market signals',
        does: 'Map signals from public sources to relationships',
      },
    } as Record<string, TaskText>,
    detail: join,
    unchanged: (unchanged: number, decided: number) => `${unchanged} of ${decided} unchanged`,
    off: 'switched off in the AI settings',
    capped: (level: string) => `at most ${level}, set by admins`,
    later: (levels: string[]) => `${levels.join(' and ')} coming later`,
    saveFailed: 'The level could not be saved. Please try again.',
    explain:
      'Suggest: a hint with reasons. Prepare: a finished draft in quick review. Do: Reziproq acts and reports it under Done, undoable with one click.',
    readOnly: 'As a reader you see the levels but cannot change them.',
    never: {
      title: 'Never automatic, at no level',
      items: [
        'Commitments on behalf of your side',
        'Approvals',
        'Confirmation of value',
        'Private content into shared areas',
        'Sending or confirming a deal',
        'Changing a mandate',
      ],
    },
    whoLabel: 'Who sees what',
    who: {
      own: 'Your settings',
      ownDetail: 'apply only to you',
      admin: 'Budget, EU processing, research',
      adminDetail: 'set by admins',
      log: 'Log',
      logDetail: 'read everything that was done',
    },
  },
});
