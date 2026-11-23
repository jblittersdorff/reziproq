import { z } from 'zod';
import { ratingOutcomeSchema } from './ratings.js';

// WG-20 (Schritt 31): Zusammenführung je Lieferant über alle Warengruppen. Zeilen je Warengruppe,
// Widersprüche nach vier Regeln, Vorschlag für das Gesamtsegment mit Rechenweg.

export const conflictRules = [
  'phase_out_vs_growth',
  'relationship_mixed',
  'concentration',
  'award_vs_target',
] as const;
export type ConflictRule = (typeof conflictRules)[number];
export const conflictStatuses = ['open', 'aligned', 'accepted'] as const;

const segment = z.object({
  impactLevel: z.number().int().min(1).max(3),
  qualityLevel: z.number().int().min(1).max(3),
  name: z.string(),
});

export const supplierCategoryRowSchema = z.object({
  groupId: z.uuid(),
  groupName: z.string(),
  lead: z.object({ userId: z.string(), name: z.string() }).nullable(),
  /** Spend des Lieferanten in der Warengruppe im letzten vollen Jahr, in Cent */
  amountCents: z.number().int().nonnegative(),
  /** Anteil des Lieferanten am Umsatz der Warengruppe, 0 bis 1 */
  shareInGroup: z.number().min(0).max(1),
  segmentIst: segment.nullable(),
  sollType: z
    .discriminatedUnion('kind', [
      segment.extend({ kind: z.literal('segment') }),
      z.object({ kind: z.literal('ended') }),
    ])
    .nullable(),
  /** Beziehungsqualität aus dem Segment Ist: 1 schwach, 2 ausbaufähig, 3 stark */
  qualityLevel: z.number().int().min(1).max(3).nullable(),
  strategy: z
    .object({
      id: z.uuid(),
      year: z.number().int(),
      version: z.number().int(),
      status: z.enum(['draft', 'resubmit', 'approved']),
    })
    .nullable(),
});
export type SupplierCategoryRow = z.infer<typeof supplierCategoryRowSchema>;

export const categoryConflictSchema = z.object({
  id: z.uuid(),
  ruleKey: z.enum(conflictRules),
  groups: z.array(z.object({ id: z.uuid(), name: z.string() })),
  status: z.enum(conflictStatuses),
  note: z.string().nullable(),
  decidedBy: z.string().nullable(),
  decidedAt: z.string().nullable(),
  createdAt: z.string(),
  canResolve: z.boolean(),
});
export type CategoryConflict = z.infer<typeof categoryConflictSchema>;

export const segmentProposalSchema = z.object({
  ist: ratingOutcomeSchema.nullable(),
  soll: ratingOutcomeSchema.nullable(),
  /** Rechenweg: je Kriterium der gewichtete Mittelwert */
  criteria: z.array(
    z.object({
      criterionKey: z.string(),
      label: z.string(),
      ist: z.number().nullable(),
      soll: z.number().nullable(),
    }),
  ),
  /** Quellen mit Gewicht (Spend-Anteil nach Normierung) */
  sources: z.array(
    z.object({
      groupId: z.uuid(),
      groupName: z.string(),
      amountCents: z.number().int(),
      weight: z.number(),
    }),
  ),
  /** Ausgelassene Warengruppen (Gründer, 23.11.2026): ohne Bewertung oder ohne Spend */
  skipped: z.array(
    z.object({
      groupId: z.uuid(),
      groupName: z.string(),
      reason: z.enum(['no_rating', 'no_spend']),
    }),
  ),
});
export type SegmentProposal = z.infer<typeof segmentProposalSchema>;

export const supplierCategoriesSchema = z.object({
  relationshipId: z.uuid(),
  supplierName: z.string(),
  spendYear: z.number().int(),
  currency: z.string(),
  totalCents: z.number().int().nonnegative(),
  rows: z.array(supplierCategoryRowSchema),
  conflicts: z.array(categoryConflictSchema),
  proposal: segmentProposalSchema.nullable(),
  /** Gesamtsegment aus SEG (jüngste Konsolidierung) */
  decided: z.object({ ist: z.string(), soll: z.string(), origin: z.string() }).nullable(),
  /** SRO oder Admin übernehmen den Vorschlag (wie die Konsolidierung in SEG) */
  canAdopt: z.boolean(),
});
export type SupplierCategories = z.infer<typeof supplierCategoriesSchema>;

export const resolveConflictSchema = z.object({
  status: z.enum(['aligned', 'accepted']),
  note: z.string().trim().min(1, 'note_required').max(2000),
});
export type ResolveConflict = z.infer<typeof resolveConflictSchema>;
