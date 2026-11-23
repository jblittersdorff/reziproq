import { z } from 'zod';
import { aiDraftSchema } from './ai-drafts.js';
import { type MeetingType, meetingTypes } from './meetings.js';

// KI-07 Termin-Briefing: acht Teile je Termin, jeder ein Entwurf (KI-03) mit Quellen. Zahlen und
// Zeiten rechnet der Code; das Modell formuliert. Nur die Agenda wird geteilt, und nur ausdrücklich.

export const briefParts = [
  'situation',
  'goals',
  'agenda',
  'internalQuestions',
  'supplierQuestions',
  'expectedQuestions',
  'risks',
  'openPoints',
] as const;
export type BriefPart = (typeof briefParts)[number];

export const briefDraftKinds = {
  situation: 'brief_situation',
  goals: 'brief_goals',
  agenda: 'brief_agenda',
  internalQuestions: 'brief_internal_questions',
  supplierQuestions: 'brief_supplier_questions',
  expectedQuestions: 'brief_expected_questions',
  risks: 'brief_risks',
  openPoints: 'brief_open_points',
} as const satisfies Record<BriefPart, string>;

/** Vorlauf in Tagen je Termintyp; null heißt: nur von Hand. 0 heißt: sofort beim Anlegen. */
export const defaultBriefLeadDays: Record<MeetingType, number | null> = {
  quarterly_review: 7,
  jbp: 7,
  negotiation: 3,
  site_visit: 3,
  escalation: 0,
  strategy_dialogue: null,
  format: null,
  other: null,
};
/** Einstellungen › Termin-Briefing: Vorlauf je Termintyp (nur Admins) */
export const briefSettingsSchema = z
  .object({
    leadDays: z.partialRecord(z.enum(meetingTypes), z.number().int().min(0).max(60).nullable()),
  })
  .strict();
export type BriefSettings = z.infer<typeof briefSettingsSchema>;

const ref = z.object({ objectType: z.string(), objectId: z.string(), title: z.string() });

export const briefGoalSchema = z.object({
  key: z.string(),
  title: z.string().trim().min(1).max(200),
  /** „Erreicht, wenn …“: prüfbares Ergebnis des Termins */
  reachedWhen: z.string().trim().min(1).max(400),
  /** Objekt, auf das das Ziel einzahlt */
  ref,
});
export type BriefGoal = z.infer<typeof briefGoalSchema>;

export const briefAgendaItemSchema = z.object({
  key: z.string(),
  kind: z.enum(['welcome', 'topic', 'break', 'closing']),
  /** Startzeit als HH:MM in der Zeit des Termins; rechnet der Code */
  start: z.string().regex(/^\d{2}:\d{2}$/),
  minutes: z.number().int().min(1).max(600),
  title: z.string().trim().min(1).max(200),
  subline: z.string().max(300).nullable(),
  /** Wer führt: nur Namen aus der Teilnehmerliste */
  leads: z.array(z.string()).max(4),
  goalKey: z.string().nullable(),
});
export type BriefAgendaItem = z.infer<typeof briefAgendaItemSchema>;

export const briefAgendaSchema = z.object({
  items: z.array(briefAgendaItemSchema).min(1).max(30),
  omitted: z.array(z.object({ topic: z.string(), reason: z.string() })).max(10),
});
export type BriefAgenda = z.infer<typeof briefAgendaSchema>;

export const briefInternalQuestionSchema = z.object({
  key: z.string(),
  text: z.string().trim().min(1).max(400),
  occasion: z.string().max(300),
  /** Person oder Rolle im eigenen Haus */
  addressee: z.object({ userId: z.string().nullable(), name: z.string() }),
  /** Nach „Senden“: die Aufgabe beim Adressaten */
  actionId: z.uuid().nullable(),
  /** Antwort aus der Aufgabe, sobald es eine gibt */
  answer: z.string().nullable(),
});
export type BriefInternalQuestion = z.infer<typeof briefInternalQuestionSchema>;

export const briefSupplierQuestionSchema = z.object({
  key: z.string(),
  text: z.string().trim().min(1).max(400),
  goalKey: z.string().nullable(),
  /** Bezug, wenn kein Ziel: z. B. eine Datenlücke */
  about: z.string().nullable(),
});

export const briefExpectedQuestionSchema = z.object({
  key: z.string(),
  text: z.string().trim().min(1).max(400),
  origin: z.string().max(300),
  /** Antwortvorschlag ohne verbindliche Mengen-, Preis- oder Terminzusage */
  answer: z.string().trim().min(1).max(600),
});

export const briefOpenPointSchema = z.object({
  key: z.string(),
  title: z.string(),
  side: z.enum(['buyer', 'supplier']),
  dueOn: z.iso.date(),
  overdue: z.boolean(),
});

/** Inhalt je Teil, wie er als JSON im Entwurf steht */
export const briefContentSchemas = {
  situation: z.object({ sentences: z.array(z.string().trim().min(1)).min(1).max(3) }),
  goals: z.object({ goals: z.array(briefGoalSchema).min(1).max(4) }),
  agenda: briefAgendaSchema,
  internalQuestions: z.object({ questions: z.array(briefInternalQuestionSchema).max(8) }),
  supplierQuestions: z.object({ questions: z.array(briefSupplierQuestionSchema).max(8) }),
  expectedQuestions: z.object({ questions: z.array(briefExpectedQuestionSchema).max(8) }),
  risks: z.object({ risks: z.array(z.object({ key: z.string(), text: z.string() })).max(12) }),
  openPoints: z.object({ points: z.array(briefOpenPointSchema).max(30) }),
} as const;
export type BriefContent = {
  [K in BriefPart]: z.infer<(typeof briefContentSchemas)[K]>;
};

const part = <T extends z.ZodType>(content: T) =>
  z.object({
    /** Offener Entwurf des letzten Laufs */
    draft: aiDraftSchema.extend({ data: content }).nullable(),
    /** Übernommener Stand */
    accepted: aiDraftSchema.extend({ data: content }).nullable(),
  });

export const meetingBriefSchema = z.object({
  /** SRO der Beziehung oder Admin: übernehmen, ändern, verwerfen, teilen, senden */
  canDecide: z.boolean(),
  /** Vorlauf dieses Termintyps in Tagen; null heißt: nur von Hand */
  leadDays: z.number().int().nullable(),
  durationMinutes: z.number().int(),
  parts: z.object({
    situation: part(briefContentSchemas.situation),
    goals: part(briefContentSchemas.goals),
    agenda: part(briefContentSchemas.agenda),
    internalQuestions: part(briefContentSchemas.internalQuestions),
    supplierQuestions: part(briefContentSchemas.supplierQuestions),
    expectedQuestions: part(briefContentSchemas.expectedQuestions),
    risks: part(briefContentSchemas.risks),
    openPoints: part(briefContentSchemas.openPoints),
  }),
  /** Teilnehmer beider Seiten */
  participants: z.array(z.object({ name: z.string(), side: z.enum(['buyer', 'supplier']) })),
  /** „Woraus das Briefing entsteht“: Zahl der Quellen je Art */
  sourceCounts: z.array(z.object({ kind: z.string(), count: z.number().int() })),
  /** „Wie aktuell“ */
  freshness: z.object({
    runId: z.uuid().nullable(),
    preparedAt: z.iso.datetime({ offset: true }).nullable(),
    /** Eingaben seit dem letzten Lauf unverändert (Prüfsumme) */
    unchanged: z.boolean(),
    running: z.boolean(),
  }),
  /** Agenda ist geteilt (steht in der geteilten Agenda des Termins) */
  agendaShared: z.boolean(),
});
export type MeetingBrief = z.infer<typeof meetingBriefSchema>;

/** Agenda vor dem Übernehmen ändern: Titel, Unterzeile, Dauer, wer führt; Zeiten rechnet der Code */
export const editBriefAgendaSchema = z
  .object({
    items: z
      .array(
        z.object({
          key: z.string(),
          title: z.string().trim().min(1).max(200),
          subline: z.string().trim().max(300).nullable(),
          minutes: z.number().int().min(1).max(600),
          leads: z.array(z.string()).max(4),
        }),
      )
      .min(1)
      .max(30),
  })
  .strict();
export type EditBriefAgenda = z.infer<typeof editBriefAgendaSchema>;

export const sendBriefQuestionSchema = z.object({ key: z.string().min(1) }).strict();

// ---------------------------------------------------------------------------------------------
// Rechenregeln, gemeinsam für API und Oberfläche. Der Code rechnet Zeiten und prüft Texte; das
// Modell formuliert höchstens die Lage.

const pad = (value: number) => String(value).padStart(2, '0');

/** HH:MM plus Minuten, ohne Zeitzone; die Startzeit kommt schon in der Zeit des Termins. */
export function addMinutes(start: string, minutes: number): string {
  const [hours = 0, mins = 0] = start.split(':').map(Number);
  const total = (hours * 60 + mins + minutes) % (24 * 60);
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Startzeiten aus der Startzeit des Termins und den Dauern, nacheinander. */
export function withStartTimes<T extends { minutes: number }>(
  start: string,
  items: T[],
): (T & { start: string })[] {
  let current = start;
  return items.map((item) => {
    const entry = { ...item, start: current };
    current = addMinutes(current, item.minutes);
    return entry;
  });
}

/**
 * Agenda planen: Begrüßung, je Ziel ein Punkt, ab 90 Minuten eine Pause in der Mitte, zum Schluss
 * „Zusagen und nächste Schritte“. Die Summe der Dauern ist genau die Dauer des Termins.
 * Passen nicht alle Ziele hinein, kommen nur so viele, wie je fünf Minuten Platz haben.
 */
export function planAgendaMinutes(duration: number, goals: number) {
  const welcome = duration >= 60 ? 10 : 5;
  const closing = duration >= 90 ? 15 : duration >= 30 ? 10 : 5;
  const pause = duration >= 90 ? 5 : 0;
  const room = duration - welcome - closing - pause;
  const count = Math.max(1, Math.min(goals, Math.floor(room / 5)));
  const each = Math.max(5, Math.floor(room / count / 5) * 5);
  const topics = Array.from({ length: count }, (_, index) =>
    index === count - 1 ? room - each * (count - 1) : each,
  );
  return { welcome, closing, pause, topics };
}

export function agendaMinutes(items: { minutes: number }[]) {
  return items.reduce((sum, item) => sum + item.minutes, 0);
}

/**
 * Antwortvorschläge dürfen keine verbindliche Mengen-, Preis- oder Terminzusage enthalten: keine
 * Zahl mit Menge, Währung, Prozent oder Frist und kein konkretes Datum.
 */
export function hasBindingCommitment(text: string): boolean {
  return (
    /\d[\d.,]*\s*(?:stück|stk|teile|einheiten|pieces|units|€|eur|euro|%|prozent|percent|wochen|weeks|tage|days|monate|months)\b/i.test(
      text,
    ) ||
    /\d[\d.,]*\s*(?:€|%)/.test(text) ||
    /\b\d{1,2}\.\d{1,2}\.(?:\d{2,4})?/.test(text) ||
    /\bwir (?:sagen|garantieren) .*zu\b/i.test(text)
  );
}

/** Text der geteilten Agenda, wie er in die Einladung geht */
export function agendaText(items: BriefAgendaItem[]): string {
  return items
    .map((item) =>
      [
        `${item.start} ${item.title} (${item.minutes} Min.)`,
        item.subline ? `  ${item.subline}` : null,
        item.leads.length > 0 ? `  ${item.leads.join(', ')}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n');
}

export const agendaBlockStart = '--- Agenda (Reziproq) ---';
export const agendaBlockEnd = '--- Ende Agenda ---';

/**
 * Agendablock in der Beschreibung einer Einladung setzen: Steht schon ein Block darin, wird nur er
 * ersetzt; sonst kommt er ans Ende. Der übrige Text bleibt unverändert.
 */
export function replaceAgendaBlock(description: string, agenda: string): string {
  const block = `${agendaBlockStart}\n${agenda}\n${agendaBlockEnd}`;
  const start = description.indexOf(agendaBlockStart);
  const end = description.indexOf(agendaBlockEnd, start);
  if (start >= 0 && end > start) {
    return `${description.slice(0, start)}${block}${description.slice(end + agendaBlockEnd.length)}`;
  }
  return description.trim() === '' ? block : `${description.replace(/\s*$/, '')}\n\n${block}`;
}
