import { z } from 'zod';
import { userFunctions } from './permissions.js';

// WG-18: Segmentierung je Warengruppe. Dieselbe Runde, dieselben Kriterien und Segmente wie SEG;
// neu sind nur der Geltungsbereich und das Segment Ist und Soll in der Warengruppe.

const levelSchema = z.object({
  impactLevel: z.number().int().min(1).max(3),
  qualityLevel: z.number().int().min(1).max(3),
});
const typedLevelSchema = levelSchema.extend({ typeName: z.string() });

export const decisionOrigins = ['round', 'manual', 'merged'] as const;

export const categorySupplierSchema = z.object({
  relationshipId: z.uuid(),
  name: z.string(),
  // Spend des letzten vollen Jahres in der Warengruppe, in Cent
  spendCents: z.number().int().nonnegative(),
  currency: z.string(),
  // Ohne Business Unit lässt sich der Lieferant nicht in eine Runde aufnehmen.
  rateable: z.boolean(),
  ratings: z.object({ submitted: z.number().int(), total: z.number().int() }),
  // Ergebnis der abgegebenen Bewertungen der jüngsten Runde der Warengruppe
  suggestion: z.object({ ist: typedLevelSchema, soll: typedLevelSchema }).nullable(),
  decision: z
    .object({
      ist: typedLevelSchema,
      soll: typedLevelSchema,
      reason: z.string(),
      origin: z.enum(decisionOrigins),
      decidedAt: z.string(),
      decidedBy: z.string(),
      version: z.number().int(),
    })
    .nullable(),
  // Gesamtentscheidung je Lieferant (SEG-06) zum Vergleich
  overall: z.object({ ist: typedLevelSchema, soll: typedLevelSchema }).nullable(),
});

export const categorySegmentationSchema = z.object({
  group: z.object({ id: z.uuid(), name: z.string() }),
  spendYear: z.number().int(),
  canManage: z.boolean(),
  round: z
    .object({
      id: z.uuid(),
      name: z.string(),
      dueDate: z.string(),
      status: z.enum(['draft', 'open', 'closed']),
      submitted: z.number().int(),
      total: z.number().int(),
    })
    .nullable(),
  // Die eingestellten Segmente des aktiven Modells; andere Namen gibt es nicht.
  types: z.array(typedLevelSchema.omit({ typeName: true }).extend({ name: z.string() })),
  raters: z.array(
    z.object({ userId: z.string(), name: z.string(), function: z.enum(userFunctions) }),
  ),
  suppliers: z.array(categorySupplierSchema),
});

export const startCategoryRoundSchema = z.object({
  dueDate: z.iso.date(),
  relationshipIds: z.array(z.uuid()).max(500),
});

export const decideCategorySegmentSchema = z.object({
  ist: levelSchema,
  soll: levelSchema,
  reason: z.string().trim().min(1).max(2000),
});

export type CategorySupplier = z.infer<typeof categorySupplierSchema>;
export type CategorySegmentation = z.infer<typeof categorySegmentationSchema>;
export type StartCategoryRound = z.infer<typeof startCategoryRoundSchema>;
export type DecideCategorySegment = z.infer<typeof decideCategorySegmentSchema>;
