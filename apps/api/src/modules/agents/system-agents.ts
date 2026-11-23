import {
  type AgentRun,
  maxPreReadWords,
  meetingTypes,
  moneySchema,
  wordCount,
} from '@reziproq/shared';
import { z } from 'zod';

/** Versionsnummer erhöhen, wenn sich Aufgabe, Werkzeug oder Ausgabe der Vorlage ändern. */
/**
 * KI-07 Termin-Briefing (früher „QBR-Vorbereitung“, Schlüssel qbr_prep): bereitet wichtige Termine
 * vor. Zahlen und Zeiten rechnet der Code; das Modell formuliert nur die Lage aus den Sätzen, die es
 * bekommt.
 */
export const meetingBrief = {
  key: 'meeting_brief',
  version: 2,
  name: 'Termin-Briefing',
  description:
    'Bereitet wichtige Termine mit einem Lieferanten vor: Lage, Ziele, Agenda, Fragen, Risiken, offene Punkte.',
  instructions:
    'Formuliere die Lage vor dem Termin in höchstens drei Sätzen. Verwende nur die übergebenen Sätze unter "situation" und keine anderen Zahlen. Schlage nichts vor, was nicht in den Sätzen steht.',
  tools: ['qbr_facts', 'supplier_context'],
  outputTarget: 'meeting_brief',
  reviewerRule: 'sro',
  modelClass: 'standard',
  budgetCents: 200,
  maxSteps: 40,
  trigger: 'schedule',
  /** Der Job prüft alle 15 Minuten, welche Termine im Vorlauf ihres Typs liegen. */
  schedule: '*/15 * * * *',
} as const;

export const qbrContextSchema = z.object({ relationshipId: z.uuid(), meetingId: z.uuid() });
export const qbrFactsSchema = z
  .object({
    meetingDay: z.iso.date(),
    meetingType: z.enum(meetingTypes),
    /** KI-07: Sätze zur Lage aus der Datenbank; das Modell darf nur sie umformulieren */
    situation: z.array(z.string().max(600)).max(3),
    agendaItems: z.number().int().nonnegative(),
    actions: z.number().int().nonnegative(),
    commitments: z.number().int().nonnegative(),
    initiatives: z.number().int().nonnegative(),
    scorecardItems: z.number().int().nonnegative(),
  })
  .strict();

export const supplierContextSchema = z
  .object({
    relationshipStatus: z.enum(['draft', 'active', 'ended']),
    actualSpend: z.array(z.object({ year: z.number().int(), amount: moneySchema })).max(3),
    submittedRatings: z.number().int().nonnegative().nullable(),
    teamNotes: z.number().int().nonnegative().nullable(),
    publishedFeedback: z.number().int().nonnegative().nullable(),
  })
  .strict();
export const qbrInputsSchema = z
  .object({
    meeting: qbrFactsSchema,
    supplier: supplierContextSchema,
  })
  .strict();

export const qbrAnswerSchema = z
  .object({
    summary: z
      .string()
      .trim()
      .min(1)
      .max(4000)
      .refine((text) => wordCount(text) <= maxPreReadWords),
  })
  .strict();

export const qbrQuestionSchema = z.object({ question: z.string().trim().min(1).max(400) }).strict();
export const qbrModelResultSchema = z.union([qbrAnswerSchema, qbrQuestionSchema]);

export const resumable = new Set<AgentRun['status']>([
  'failed',
  'aborted_budget',
  'cancelled',
  'waiting_input',
]);
