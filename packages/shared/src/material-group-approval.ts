import { z } from 'zod';
import { goalDimensions } from './material-group-strategy.js';

// WG-16 (Schritt 30): Freigabe der Warengruppenstrategie. Relevanz aus zehn Einschätzungen,
// Freigabeweg aus Relevanz und Umsatz, Zusammenfassung in drei Teilen, Unterschriften je Vorlage,
// neue Version statt Änderung einer freigegebenen Strategie.

/** Je Zieldimension zwei Kriterien (Gründer, 23.11.2026) */
export const relevanceCriteria = ['impact', 'risk'] as const;
export type RelevanceCriterion = (typeof relevanceCriteria)[number];
export const relevanceKeys = goalDimensions.flatMap((dimension) =>
  relevanceCriteria.map((criterion) => `${dimension}.${criterion}`),
);

export const relevanceScoresSchema = z
  .record(z.string(), z.number().int().min(1).max(6))
  .refine(
    (scores) =>
      Object.keys(scores).length === relevanceKeys.length &&
      relevanceKeys.every((key) => key in scores),
    { message: 'relevance_incomplete' },
  );
export type RelevanceScores = z.infer<typeof relevanceScoresSchema>;

/** Mittelwert der zehn Einschätzungen, zwei Nachkommastellen */
export function relevanceScore(scores: Record<string, number>) {
  const values = relevanceKeys
    .map((key) => scores[key])
    .filter((v): v is number => v !== undefined);
  if (values.length !== relevanceKeys.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

export const approvalRoutes = ['board', 'head', 'tandem', 'department'] as const;
export type ApprovalRoute = (typeof approvalRoutes)[number];

/**
 * Freigabeweg (WG-16): hoch/hoch Leitungsgremium, hoch/geringer Einkaufsleitung im Umlauf, beide mit
 * Commodity Manager; geringer/hoch zwei Abteilungsleitungen im Tandem; geringer/geringer die
 * Abteilungsleitung des Leads.
 */
export function approvalRouteOf(relevanceHigh: boolean, spendHigh: boolean): ApprovalRoute {
  if (relevanceHigh) return spendHigh ? 'board' : 'head';
  return spendHigh ? 'tandem' : 'department';
}
export const commodityManagerRequired = (route: ApprovalRoute) =>
  route === 'board' || route === 'head';

export const approvalSettingsSchema = z.object({
  /** Relevanz hoch ab diesem Mittelwert */
  relevanceThreshold: z.number().min(1).max(6),
  /** Umsatz hoch ab diesem Ist-Spend des letzten Jahres, in Cent */
  spendThresholdCents: z.number().int().nonnegative(),
  /** Freigebende je Weg; alle unterschreiben */
  routes: z.object({
    board: z.array(z.string()).max(20),
    head: z.array(z.string()).max(20),
    tandem: z.array(z.string()).max(20),
    department: z.array(z.string()).max(20),
  }),
});
export type ApprovalSettings = z.infer<typeof approvalSettingsSchema>;
export const defaultApprovalSettings: ApprovalSettings = {
  relevanceThreshold: 3.5,
  spendThresholdCents: 500_000_000,
  routes: { board: [], head: [], tandem: [], department: [] },
};

export const approvalSettingsViewSchema = z.object({
  settings: approvalSettingsSchema,
  people: z.array(z.object({ userId: z.string(), name: z.string() })),
  canEdit: z.boolean(),
});
export type ApprovalSettingsView = z.infer<typeof approvalSettingsViewSchema>;

const summaryParts = ['statusQuo', 'targetState', 'roadmap'] as const;
export type SummaryPart = (typeof summaryParts)[number];

export const submitBlockers = [
  'steps_open',
  'summary_unconfirmed',
  'relevance_missing',
  'approvers_missing',
  'not_lead',
  'approved',
] as const;
export type SubmitBlocker = (typeof submitBlockers)[number];

export const strategyApprovalSchema = z.object({
  id: z.uuid(),
  role: z.enum(['lead', 'commodity_manager', 'approver']),
  userId: z.string(),
  name: z.string(),
  status: z.enum(['open', 'signed', 'returned']),
  comment: z.string().nullable(),
  decidedAt: z.string().nullable(),
  /** Die angemeldete Person kann diese Unterschrift leisten */
  canDecide: z.boolean(),
});

export const approvalViewSchema = z.object({
  strategyId: z.uuid(),
  year: z.number().int(),
  version: z.number().int(),
  status: z.enum(['draft', 'resubmit', 'approved']),
  canEdit: z.boolean(),
  canSubmit: z.boolean(),
  blockers: z.array(z.enum(submitBlockers)),
  openSteps: z.array(z.number().int()),
  relevance: z.object({
    scores: z.record(z.string(), z.number().int()),
    score: z.number().nullable(),
    override: z.enum(['high', 'low']).nullable(),
    overrideReason: z.string().nullable(),
    high: z.boolean().nullable(),
    canOverride: z.boolean(),
  }),
  spend: z
    .object({ amountCents: z.number().int(), currency: z.string(), high: z.boolean() })
    .nullable(),
  route: z.enum(approvalRoutes).nullable(),
  summary: z.object({
    statusQuo: z.string(),
    targetState: z.string(),
    roadmap: z.string(),
    status: z.enum(['draft', 'confirmed']),
    /** Teile, die sich seit der letzten Vorlage geändert haben */
    changed: z.array(z.enum(summaryParts)),
  }),
  lastSubmittedAt: z.string().nullable(),
  changedSinceSubmission: z.boolean(),
  approvals: z.array(strategyApprovalSchema),
  versions: z.array(
    z.object({
      id: z.uuid(),
      version: z.number().int(),
      status: z.enum(['draft', 'resubmit', 'approved']),
    }),
  ),
  canNewVersion: z.boolean(),
});
export type ApprovalView = z.infer<typeof approvalViewSchema>;

export const summaryRequestSchema = z.object({
  statusQuo: z.string().trim().max(4000),
  targetState: z.string().trim().max(4000),
  roadmap: z.string().trim().max(4000),
});
export type SummaryRequest = z.infer<typeof summaryRequestSchema>;

export const relevanceRequestSchema = z.object({ scores: relevanceScoresSchema });
export const relevanceOverrideSchema = z
  .object({ override: z.enum(['high', 'low']).nullable(), reason: z.string().trim().max(1000) })
  .refine((value) => value.override === null || value.reason.length > 0, {
    message: 'reason_required',
  });
export type RelevanceOverride = z.infer<typeof relevanceOverrideSchema>;

export const returnRequestSchema = z.object({
  comment: z.string().trim().min(1, 'comment_required').max(2000),
});
