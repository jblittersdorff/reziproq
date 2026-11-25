import { z } from 'zod';

// WG-12 (Schritt 27): Scorecard der Warengruppe (Initiativen je gewähltem Hebel) und Quartals-Review.
// Alles org_private; eine Initiative der Warengruppe ist nicht die geteilte Initiative des Ledgers.

export const initiativeHorizons = ['short', 'mid', 'long'] as const;
export type InitiativeHorizon = (typeof initiativeHorizons)[number];

/** Kurz 1 Jahr, mittel 2 bis 3, lang 4 bis 5, gezählt ab dem Strategiejahr */
export function horizonOf(
  targetYear: number | null,
  strategyYear: number,
): InitiativeHorizon | null {
  if (targetYear === null) return null;
  const years = targetYear - strategyYear + 1;
  if (years <= 1) return 'short';
  if (years <= 3) return 'mid';
  return 'long';
}

const person = z.object({ userId: z.string(), name: z.string() });
const supplier = z.object({ relationshipId: z.uuid(), name: z.string() });

export const categoryInitiativeSchema = z.object({
  id: z.uuid(),
  goalId: z.uuid(),
  leverChoiceId: z.uuid(),
  name: z.string(),
  effect: z.string(),
  actual: z.number().nullable(),
  target: z.number().nullable(),
  ownerUserId: z.string().nullable(),
  ownerName: z.string().nullable(),
  targetQuarter: z.number().int().nullable(),
  targetYear: z.number().int().nullable(),
  horizon: z.enum(initiativeHorizons).nullable(),
  progress: z.number().int(),
  suppliers: z.array(supplier),
  /** Fortschritt melden: verantwortliche Person oder wer die Scorecard bearbeitet */
  canReport: z.boolean(),
});
export type CategoryInitiative = z.infer<typeof categoryInitiativeSchema>;

export const categoryScorecardSchema = z.object({
  canEdit: z.boolean(),
  initiatives: z.array(categoryInitiativeSchema),
  goals: z.array(
    z.object({ id: z.uuid(), dimension: z.string(), text: z.string(), kpiName: z.string() }),
  ),
  /** Gewählte Hebel (WG-10) als Paarung mit Hebelname */
  choices: z.array(z.object({ id: z.uuid(), pairing: z.string(), leverName: z.string() })),
  /** Gewählte Hebel ohne Initiative: die Seite warnt und verweist auf Schritt 6 */
  missingChoiceIds: z.array(z.uuid()),
  suppliers: z.array(supplier),
  people: z.array(person),
  reviews: z.array(z.object({ id: z.uuid(), dueOn: z.string(), heldAt: z.string().nullable() })),
});
export type CategoryScorecard = z.infer<typeof categoryScorecardSchema>;

const decimal = z.number().finite().nullable().optional();

export const initiativeRequestSchema = z
  .object({
    goalId: z.uuid({ message: 'goal_required' }),
    leverChoiceId: z.uuid({ message: 'lever_required' }),
    name: z.string().trim().min(1, { message: 'name_required' }).max(200),
    effect: z.string().trim().max(500).default(''),
    actual: decimal,
    target: decimal,
    ownerUserId: z.string().min(1).nullable().optional(),
    targetQuarter: z.number().int().min(1).max(4).nullable().optional(),
    targetYear: z.number().int().min(2000).max(2100).nullable().optional(),
    supplierIds: z.array(z.uuid()).max(50).default([]),
  })
  .strict();
export type InitiativeRequest = z.input<typeof initiativeRequestSchema>;

export const initiativeProgressSchema = z
  .object({ progress: z.number().int().min(0).max(100), actual: decimal })
  .strict();
export type InitiativeProgress = z.infer<typeof initiativeProgressSchema>;

/** GET /warengruppen/reviews/:id: Fortschritt je Initiative, Zusagen und Maßnahmen der Lieferanten */
export const categoryReviewSchema = z.object({
  id: z.uuid(),
  groupId: z.uuid(),
  groupName: z.string(),
  strategyId: z.uuid(),
  year: z.number().int(),
  dueOn: z.string(),
  heldAt: z.string().nullable(),
  heldBy: z.string().nullable(),
  summary: z.string().nullable(),
  canHold: z.boolean(),
  initiatives: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      goal: z.string(),
      lever: z.string(),
      progress: z.number().int(),
      actual: z.number().nullable(),
      target: z.number().nullable(),
      ownerName: z.string().nullable(),
    }),
  ),
  commitments: z.array(
    z.object({
      id: z.uuid(),
      supplier: z.string(),
      relationshipId: z.uuid(),
      title: z.string(),
      dueOn: z.string(),
      side: z.enum(['buyer', 'supplier']),
    }),
  ),
  actions: z.array(
    z.object({
      id: z.uuid(),
      supplier: z.string(),
      relationshipId: z.uuid(),
      title: z.string(),
      dueDate: z.string().nullable(),
      status: z.string(),
    }),
  ),
});
export type CategoryReview = z.infer<typeof categoryReviewSchema>;

export const holdReviewSchema = z.object({ summary: z.string().trim().min(1).max(2000) }).strict();
export type HoldReview = z.infer<typeof holdReviewSchema>;
