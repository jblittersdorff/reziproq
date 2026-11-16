import { eq, schema, type TenantTransaction } from '@reziproq/db';

type PlanRow = typeof schema.supplierPlan.$inferSelect;

/**
 * Kopie eines Lieferantenplans als Entwurf: Zusammenfassung, Ziele und Themen mit ihren Zielen.
 * Für eine neue Version im selben Zyklus (SPL-07) und für den nächsten Zyklus (ZYK-05). Der
 * Ausgangsplan bleibt unverändert.
 */
export async function copyPlan(
  tx: TenantTransaction,
  plan: PlanRow,
  target: { cycleId: string; version: number },
): Promise<string> {
  const [copy] = await tx
    .insert(schema.supplierPlan)
    .values({
      relationshipId: plan.relationshipId,
      cycleId: target.cycleId,
      version: target.version,
      summary: plan.summary,
    })
    .returning({ id: schema.supplierPlan.id });
  const newId = (copy as { id: string }).id;
  const objectives = await tx
    .select()
    .from(schema.planObjective)
    .where(eq(schema.planObjective.planId, plan.id));
  const objectiveIds = new Map<string, string>();
  for (const objective of objectives) {
    const [created] = await tx
      .insert(schema.planObjective)
      .values({ ...objective, id: undefined, planId: newId })
      .returning({ id: schema.planObjective.id });
    objectiveIds.set(objective.id, (created as { id: string }).id);
  }
  const topics = await tx
    .select()
    .from(schema.strategicTopic)
    .where(eq(schema.strategicTopic.planId, plan.id));
  for (const topic of topics) {
    const [created] = await tx
      .insert(schema.strategicTopic)
      .values({ ...topic, id: undefined, planId: newId })
      .returning({ id: schema.strategicTopic.id });
    const links = await tx
      .select({ objectiveId: schema.strategicTopicObjective.objectiveId })
      .from(schema.strategicTopicObjective)
      .where(eq(schema.strategicTopicObjective.topicId, topic.id));
    const mapped = links
      .map((link) => objectiveIds.get(link.objectiveId))
      .filter((id): id is string => Boolean(id));
    if (mapped.length > 0) {
      await tx.insert(schema.strategicTopicObjective).values(
        mapped.map((objectiveId) => ({
          relationshipId: plan.relationshipId,
          topicId: (created as { id: string }).id,
          objectiveId,
        })),
      );
    }
  }
  return newId;
}
