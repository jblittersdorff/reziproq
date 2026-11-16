import { z } from 'zod';

// SEG-11 (auch PUL-08, SPL-10, QBR-07): Entwürfe der KI. Ein Entwurf bleibt sichtbar Entwurf, bis
// ihn jemand übernimmt; verworfene verschwinden.

export const aiDraftStatuses = ['draft', 'accepted', 'discarded'] as const;
export type AiDraftStatus = (typeof aiDraftStatuses)[number];

export const aiDraftSchema = z.object({
  id: z.uuid(),
  status: z.enum(aiDraftStatuses),
  content: z.string(),
  model: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
  decidedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type AiDraft = z.infer<typeof aiDraftSchema>;

/** Wie viele der größten Abweichungen die KI erklärt */
export const deviationExplanationCount = 3;

/** Eine der größten Abweichungen mit Entwurf oder übernommener Erklärung */
export const deviationExplanationSchema = z.object({
  criterionKey: z.string(),
  criterionName: z.string(),
  /** Spannweite zwischen höchstem und niedrigstem Ist-Wert */
  range: z.number(),
  /** Anzahl der Begründungen, aus denen die Erklärung entsteht */
  reasons: z.number().int(),
  /** Offener Entwurf; nur für SRO und Admin */
  draft: aiDraftSchema.nullable(),
  /** Übernommene Erklärung; für alle, die die Segmentierung sehen */
  accepted: aiDraftSchema.nullable(),
});
export type DeviationExplanation = z.infer<typeof deviationExplanationSchema>;

export const deviationExplanationsSchema = z.object({
  roundId: z.uuid().nullable(),
  explanations: z.array(deviationExplanationSchema),
  /** SRO der Beziehung oder Admin */
  canExplain: z.boolean(),
  /** Nach „Abweichungen erklären“: Kriterien ohne Begründung, für die kein Entwurf entstand */
  withoutReasons: z.array(z.string()),
});
export type DeviationExplanations = z.infer<typeof deviationExplanationsSchema>;
