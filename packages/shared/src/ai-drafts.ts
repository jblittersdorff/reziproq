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

/** PUL-08: Mindestens so viele Freitexte braucht eine Zusammenfassung */
export const minFreeTextsForThemes = 3;
/** PUL-08: höchstens so viele Themen */
export const maxFeedbackThemes = 5;
/** PUL-08: Eine gemeinsame Wortfolge mit mehr Wörtern gilt als Zitat */
export const maxQuotedWords = 8;

/** Themen aus dem Inhalt eines Entwurfs: je Zeile ein Thema mit einem Satz */
export function feedbackThemesOf(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, maxFeedbackThemes);
}

export const feedbackThemesSchema = z.object({
  /** Anzahl der Freitexte der anderen Seite, die diese Seite sehen darf */
  freeTexts: z.number().int(),
  /** SRO bzw. Key Account Manager oder Admin */
  canSummarize: z.boolean(),
  /** Offener Entwurf; nur für die, die zusammenfassen dürfen */
  draft: aiDraftSchema.nullable(),
  /** Übernommene Zusammenfassung der eigenen Seite */
  accepted: aiDraftSchema.nullable(),
});
export type FeedbackThemes = z.infer<typeof feedbackThemesSchema>;
