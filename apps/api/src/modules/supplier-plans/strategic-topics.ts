import { and, asc, eq, schema, type TenantTransaction } from '@reziproq/db';
import type { StrategicTopic } from '@reziproq/shared';

/** Strategische Themen eines Plans in ihrer Reihenfolge, mit den verknüpften Zielen (SPL-06). */
export async function readTopics(
  tx: TenantTransaction,
  relationshipId: string,
  planId: string,
): Promise<StrategicTopic[]> {
  const topics = await tx
    .select()
    .from(schema.strategicTopic)
    .where(
      and(
        eq(schema.strategicTopic.planId, planId),
        eq(schema.strategicTopic.relationshipId, relationshipId),
      ),
    )
    .orderBy(asc(schema.strategicTopic.priority), asc(schema.strategicTopic.id));
  const links = await tx
    .select({
      topicId: schema.strategicTopicObjective.topicId,
      objectiveId: schema.planObjective.id,
      text: schema.planObjective.text,
    })
    .from(schema.strategicTopicObjective)
    .innerJoin(
      schema.planObjective,
      eq(schema.planObjective.id, schema.strategicTopicObjective.objectiveId),
    )
    .where(eq(schema.strategicTopicObjective.relationshipId, relationshipId))
    .orderBy(asc(schema.planObjective.targetYear), asc(schema.planObjective.text));
  return topics.map((topic) => ({
    id: topic.id,
    title: topic.title,
    reason: topic.reason,
    priority: topic.priority,
    objectives: links
      .filter((link) => link.topicId === topic.id)
      .map((link) => ({ id: link.objectiveId, text: link.text })),
  }));
}
