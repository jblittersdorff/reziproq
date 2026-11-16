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

/** SPL-10: höchstens so viele Wörter hat der Entwurf der Strategie-Zusammenfassung */
export const maxPlanSummaryWords = 120;

/** Wörter eines Textes, getrennt an Leerraum */
export const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

/**
 * Kürzt einen Text auf höchstens max Wörter. Endet er dann mitten im Satz, endet er am letzten
 * vollständigen Satz, sofern davon genug übrig bleibt; sonst mit „…“.
 */
export function limitWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= max) return words.join(' ');
  const cut = words.slice(0, max).join(' ');
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (end > cut.length / 2) return cut.slice(0, end + 1);
  return `${words.slice(0, max - 1).join(' ')} …`;
}

export const planSummaryDraftSchema = z.object({
  /** SRO der Beziehung oder Admin, solange der Plan ein Entwurf ist */
  canDraft: z.boolean(),
  /** Offener KI-Entwurf */
  draft: aiDraftSchema.nullable(),
});
export type PlanSummaryDraft = z.infer<typeof planSummaryDraftSchema>;

/** QBR-07: höchstens so viele Wörter hat die Zusammenfassung im Pre-Read */
export const maxPreReadWords = 200;

export const preReadDraftSchema = z.object({
  /** SRO bzw. Key Account Manager oder Admin */
  canDraft: z.boolean(),
  /** Offener KI-Entwurf der eigenen Seite */
  draft: aiDraftSchema.nullable(),
  /** Übernommene Zusammenfassung der eigenen Seite; steht im Pre-Read-PDF */
  accepted: aiDraftSchema.nullable(),
});
export type PreReadDraft = z.infer<typeof preReadDraftSchema>;

/** Übernehmen, auch mit bearbeitetem Text; nie mehr als 200 Wörter */
export const acceptPreReadSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1)
      .max(4000)
      .refine((text) => wordCount(text) <= maxPreReadWords, {
        message: `Höchstens ${maxPreReadWords} Wörter`,
      }),
  })
  .strict();
export type AcceptPreRead = z.infer<typeof acceptPreReadSchema>;
