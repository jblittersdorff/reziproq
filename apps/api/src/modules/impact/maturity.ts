import { asc, eq, schema, type TenantTransaction } from '@reziproq/db';
import type { Maturity } from '@reziproq/shared';

/**
 * Reifegrad einer Initiative (PNL-03): Start R1, jede Stufe aus maturity_step (geteilt). Beide
 * Seiten lesen ihn gleich; die Nachweise sind teilbar formuliert, die Baseline steht nie darin.
 */
export async function maturityOf(tx: TenantTransaction, initiativeId: string): Promise<Maturity> {
  const steps = await tx
    .select()
    .from(schema.maturityStep)
    .where(eq(schema.maturityStep.initiativeId, initiativeId))
    .orderBy(asc(schema.maturityStep.decidedAt));
  return {
    level: steps.at(-1)?.toLevel ?? 1,
    steps: steps.map((step) => ({
      fromLevel: step.fromLevel,
      toLevel: step.toLevel,
      evidence: step.evidence,
      evidenceLink: step.evidenceLink,
      decidedByName: step.decidedByName,
      decidedAt: step.decidedAt.toISOString(),
    })),
  };
}
