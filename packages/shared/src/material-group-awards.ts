import { z } from 'zod';

// WG-14 (Schritt 29): Vergabeplan der Warengruppenstrategie. Vergaben mit Anfragezeitraum,
// Vergabedatum, Volumen und möglichen Lieferanten; gleicher Bündelschlüssel heißt gebündelt.

/** Bedingungen für Vergabefähigkeit (Admin); eine aktive Beziehung ist immer Pflicht. */
export const awardEligibilitySchema = z.object({
  /** Nicht „kritisch“ in der Qualitätssicht (WG-07) */
  qualityNotCritical: z.boolean(),
  /** Nicht „kritisch“ in der Lieferkettenstabilität (WG-07) */
  stabilityNotCritical: z.boolean(),
});
export type AwardEligibility = z.infer<typeof awardEligibilitySchema>;
export const defaultAwardEligibility: AwardEligibility = {
  qualityNotCritical: true,
  stabilityNotCritical: true,
};

export const awardIneligibleReasons = [
  'inactive',
  'quality_critical',
  'stability_critical',
] as const;
export type AwardIneligibleReason = (typeof awardIneligibleReasons)[number];

const supplierRef = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('relationship'), id: z.uuid() }),
  z.object({ kind: z.literal('candidate'), id: z.uuid() }),
]);

export const awardOptionSchema = z.object({
  kind: z.enum(['relationship', 'candidate']),
  id: z.uuid(),
  name: z.string(),
  eligible: z.boolean(),
  reasons: z.array(z.enum(awardIneligibleReasons)),
  /** Soll „beenden“ in der Supplier Map (WG-15) */
  ended: z.boolean(),
});
export type AwardOption = z.infer<typeof awardOptionSchema>;

export const categoryAwardSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  volumeCents: z.number().int().nonnegative().nullable(),
  currency: z.string(),
  requestFrom: z.string().nullable(),
  requestTo: z.string().nullable(),
  awardDate: z.string().nullable(),
  bundleKey: z.string().nullable(),
  /** Eine weitere Vergabe derselben Strategie hat denselben Bündelschlüssel */
  bundled: z.boolean(),
  suppliers: z.array(
    z.object({
      kind: z.enum(['relationship', 'candidate']),
      id: z.uuid(),
      name: z.string(),
      note: z.string().nullable(),
      ended: z.boolean(),
    }),
  ),
  /** Mögliche Lieferanten mit Soll „beenden“: die Seite warnt */
  endedSuppliers: z.array(z.string()),
});
export type CategoryAward = z.infer<typeof categoryAwardSchema>;

export const awardPlanSchema = z.object({
  canEdit: z.boolean(),
  strategyYear: z.number().int(),
  awards: z.array(categoryAwardSchema),
  options: z.array(awardOptionSchema),
  eligibility: awardEligibilitySchema,
  /** Schritt 8: jede Vergabe hat mindestens einen möglichen Lieferanten und ein Volumen */
  complete: z.boolean(),
});
export type AwardPlan = z.infer<typeof awardPlanSchema>;

const day = z.iso.date();
export const awardRequestSchema = z
  .object({
    name: z.string().trim().min(1, 'name_required').max(200),
    volumeCents: z.number().int().nonnegative().nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default('EUR'),
    requestFrom: day.nullable(),
    requestTo: day.nullable(),
    awardDate: day.nullable(),
    bundleKey: z.string().trim().max(60).nullable(),
    suppliers: z.array(supplierRef.and(z.object({ note: z.string().trim().max(500).nullable() }))),
  })
  .superRefine((value, context) => {
    if (value.requestFrom && value.requestTo && value.requestFrom > value.requestTo) {
      context.addIssue({ code: 'custom', path: ['requestTo'], message: 'request_order' });
    }
  });
export type AwardRequest = z.input<typeof awardRequestSchema>;

/** Schritt 8 fertig, wenn es Vergaben gibt und jede einen möglichen Lieferanten und ein Volumen hat */
export function awardPlanComplete(awards: { volumeCents: number | null; suppliers: unknown[] }[]) {
  return (
    awards.length > 0 &&
    awards.every((award) => award.volumeCents !== null && award.suppliers.length > 0)
  );
}
