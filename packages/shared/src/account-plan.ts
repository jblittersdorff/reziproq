import { z } from 'zod';

// LIF-03: Eigene Sicht des Lieferanten auf einen Kunden. Nur die Lieferantenseite sieht sie.

export const accountObjectiveSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  ownerUserId: z.string().nullable(),
  ownerName: z.string().nullable(),
  targetYear: z.number().int(),
});
export type AccountObjective = z.infer<typeof accountObjectiveSchema>;

export const accountPlanSchema = z.object({
  plan: z
    .object({
      summary: z.string().nullable(),
      ownView: z.string().nullable(),
      importance: z.number().int().min(1).max(5).nullable(),
      updatedAt: z.string(),
      updatedByName: z.string(),
    })
    .nullable(),
  objectives: z.array(accountObjectiveSchema),
  /** Personen der eigenen Organisation für „verantwortlich“ */
  people: z.array(z.object({ userId: z.string(), name: z.string() })),
  canEdit: z.boolean(),
});
export type AccountPlan = z.infer<typeof accountPlanSchema>;

const longText = z.string().trim().max(4000);

export const saveAccountSummarySchema = z.object({ summary: longText.nullable() }).strict();
export type SaveAccountSummary = z.infer<typeof saveAccountSummarySchema>;

export const saveAccountViewSchema = z
  .object({
    ownView: longText.nullable(),
    importance: z.number().int().min(1).max(5).nullable(),
  })
  .strict();
export type SaveAccountView = z.infer<typeof saveAccountViewSchema>;

export const saveAccountObjectiveSchema = z
  .object({
    text: z.string().trim().min(1).max(500),
    ownerUserId: z.string().min(1).nullable(),
    targetYear: z.number().int().min(2000).max(2100),
  })
  .strict();
export type SaveAccountObjective = z.infer<typeof saveAccountObjectiveSchema>;
