import { type AgentRun, maxPreReadWords, moneySchema, wordCount } from '@reziproq/shared';
import { z } from 'zod';

/** Versionsnummer erhöhen, wenn sich Aufgabe, Werkzeug oder Ausgabe der Vorlage ändern. */
export const qbrPreparation = {
  key: 'qbr_prep',
  version: 1,
  name: 'QBR-Vorbereitung',
  description:
    'Bereitet den Quartalsreview anhand der sichtbaren Kennzahlen und offenen Punkte vor.',
  instructions: 'Fasse ausschließlich die übergebenen, strukturierten Terminfakten knapp zusammen.',
  tools: ['qbr_facts', 'supplier_context'],
  outputTarget: 'pre_read',
  reviewerRule: 'sro',
  modelClass: 'standard',
  budgetCents: 200,
  maxSteps: 8,
  trigger: 'manual',
} as const;

export const qbrContextSchema = z.object({ relationshipId: z.uuid(), meetingId: z.uuid() });
export const qbrFactsSchema = z
  .object({
    meetingDay: z.iso.date(),
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
