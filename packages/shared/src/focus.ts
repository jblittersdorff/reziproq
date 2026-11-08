import { z } from 'zod';

// SEG-02: Fokuslieferanten der Käuferorganisation. Nur der Käufer sieht und ändert sie.

export const focusReasons = ['spend_share', 'target_type'] as const;
export type FocusReason = (typeof focusReasons)[number];

const levelsSchema = z.object({
  impactLevel: z.number().int().min(1).max(3),
  qualityLevel: z.number().int().min(1).max(3),
  typeName: z.string(),
});

export const focusItemSchema = z.object({
  relationshipId: z.uuid(),
  name: z.string(),
  // Spend des letzten vollen Jahres in Cent; 0, wenn keiner erfasst ist
  spendCents: z.number().int().nonnegative(),
  currency: z.string(),
  // Anteil am Gesamtspend derselben Währung in Prozent, eine Nachkommastelle
  sharePercent: z.number(),
  ist: levelsSchema.nullable(),
  soll: levelsSchema.nullable(),
});

export const focusListSchema = z.object({
  spendYear: z.number().int(),
  spendShare: z.number().int(),
  canEdit: z.boolean(),
  focus: z.array(focusItemSchema.extend({ reason: z.string() })),
  suggestions: z.array(focusItemSchema.extend({ reasons: z.array(z.enum(focusReasons)) })),
});

export const focusDetailSchema = focusItemSchema.extend({
  spendYear: z.number().int(),
  isFocus: z.boolean(),
  reason: z.string().nullable(),
  setAt: z.iso.datetime().nullable(),
  setBy: z.string().nullable(),
  suggestionReasons: z.array(z.enum(focusReasons)),
  canEdit: z.boolean(),
});

export const setFocusRequestSchema = z.object({
  isFocus: z.boolean(),
  reason: z.string().trim().min(1, 'required').max(1000, 'too_long'),
});

export type FocusItem = z.infer<typeof focusItemSchema>;
export type FocusList = z.infer<typeof focusListSchema>;
export type FocusDetail = z.infer<typeof focusDetailSchema>;
export type SetFocusRequest = z.infer<typeof setFocusRequestSchema>;
