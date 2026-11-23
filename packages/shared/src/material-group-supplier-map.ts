import { z } from 'zod';
import { surveyDimensions } from './survey.js';

// WG-15 (Schritt 28): Supplier Map der Warengruppenstrategie. Umsatzanteil Ist aus dem Spend,
// Segment Ist aus der Segmentierung der Warengruppe (WG-18); Soll-Typ ist das Soll derselben
// Segmententscheidung (Gründer, 23.11.2026), dazu Umsatzanteil Soll, Zieljahr und Standort.

const level = {
  impactLevel: z.number().int().min(1).max(3),
  qualityLevel: z.number().int().min(1).max(3),
};
/** Ein Segment aus SEG: Business Impact und Beziehungsqualität mit dem eingestellten Namen */
const namedSegment = z.object({ ...level, name: z.string() });

export const supplierMapTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('segment'), ...level, name: z.string() }),
  z.object({ kind: z.literal('ended') }),
]);
export type SupplierMapTarget = z.infer<typeof supplierMapTargetSchema>;

export const supplierMapRowSchema = z.object({
  relationshipId: z.uuid(),
  name: z.string(),
  site: z.string().nullable(),
  /** Spend des letzten vollen Jahres in der Warengruppe, in Cent */
  amountCents: z.number().int().nonnegative(),
  /** Umsatzanteil Ist, 0 bis 1 */
  share: z.number().min(0).max(1),
  /** Umsatzanteil Soll in ganzen Prozent */
  shareTarget: z.number().int().min(0).max(100).nullable(),
  targetYear: z.number().int().nullable(),
  /** Segment Ist der Warengruppe; null ohne Entscheidung oder wenn das Segment nicht mehr eingestellt ist */
  segmentIst: namedSegment.nullable(),
  segmentTarget: supplierMapTargetSchema.nullable(),
  /** Beziehung laut Feedback: größte Lücke der letzten aufgedeckten Welle */
  feedbackGap: z.object({ dimension: z.enum(surveyDimensions), delta: z.number() }).nullable(),
  /** Anteil Soll und Soll-Typ stehen */
  complete: z.boolean(),
});
export type SupplierMapRow = z.infer<typeof supplierMapRowSchema>;

export const supplierMapSchema = z.object({
  canEdit: z.boolean(),
  /** Nur die Zeilen, für die die Person SRO ist (Entwurf ohne Rolle im Team) */
  restricted: z.boolean(),
  strategyYear: z.number().int(),
  spendYear: z.number().int(),
  currency: z.string(),
  totalCents: z.number().int().nonnegative(),
  /** Einzeln gezeigt: die Lieferanten mit den obersten 80 % des Umsatzes */
  rows: z.array(supplierMapRowSchema),
  /** Der Rest, zusammengefasst und aufklappbar */
  rest: z.array(supplierMapRowSchema),
  restCents: z.number().int().nonnegative(),
  restShare: z.number().min(0).max(1),
  /** Eingestellte Segmente des aktiven Modells, für den Soll-Typ */
  segmentTypes: z.array(namedSegment),
  /** Schritt 9: jeder einzeln gezeigte Lieferant hat Anteil Soll und Soll-Typ */
  complete: z.boolean(),
  /** Größter Lieferant, zu dem „An das Lieferantenmanagement übergeben“ führt */
  handoverRelationshipId: z.uuid().nullable(),
});
export type SupplierMap = z.infer<typeof supplierMapSchema>;

export const supplierMapUpdateSchema = z
  .object({
    site: z.string().trim().max(120).nullable(),
    shareTarget: z.number().int().min(0).max(100).nullable(),
    targetYear: z.number().int().min(2000).max(2100).nullable(),
    /** Ohne Angabe bleibt der Soll-Typ, wie er ist */
    segmentTarget: z
      .discriminatedUnion('kind', [
        z.object({ kind: z.literal('segment'), ...level }),
        z.object({ kind: z.literal('ended') }),
      ])
      .optional(),
  })
  .superRefine((value, context) => {
    if ((value.shareTarget !== null || value.segmentTarget) && value.targetYear === null) {
      context.addIssue({ code: 'custom', path: ['targetYear'], message: 'target_year_required' });
    }
  });
export type SupplierMapUpdate = z.infer<typeof supplierMapUpdateSchema>;

/** Schritt 9 fertig, wenn jeder einzeln gezeigte Lieferant Anteil Soll und Soll-Typ hat */
export function supplierMapComplete(rows: { complete: boolean }[]) {
  return rows.length > 0 && rows.every((row) => row.complete);
}
