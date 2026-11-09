import { and, desc, eq, inArray, schema, sql, type TenantTransaction } from '@reziproq/db';
import type { OverviewMetric } from '@reziproq/shared';
import type { AuthContext } from '../auth/auth.guard.js';
import type { OverviewMetricSource } from '../overview/overview-metric.js';

/**
 * Kennzahl für den Überblick (NAV-06): Stand des Gemeinsamen Plans mit Termin, offenen oder
 * zusammengeführten Themen (JBP-02) und Initiativen (JBP-03). Ohne Plan keine Kennzahl.
 */
export class JbpMetricSource implements OverviewMetricSource {
  async overviewMetric(
    relationshipId: string,
    _user: AuthContext,
    tx: TenantTransaction,
  ): Promise<OverviewMetric | null> {
    const { jbp, meeting, jbpTopic, initiative } = schema;
    const [plan] = await tx
      .select({ id: jbp.id, status: jbp.status, startsAt: meeting.startsAt })
      .from(jbp)
      .leftJoin(meeting, eq(meeting.id, jbp.meetingId))
      .where(eq(jbp.relationshipId, relationshipId))
      .orderBy(desc(jbp.version))
      .limit(1);
    if (!plan) return null;
    const [topics] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(jbpTopic)
      .where(and(eq(jbpTopic.jbpId, plan.id), inArray(jbpTopic.status, ['proposed', 'merged'])));
    const [initiatives] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(initiative)
      .where(eq(initiative.jbpId, plan.id));
    return {
      tile: 'plan',
      kind: 'jbp',
      status: plan.status,
      meetingDate: plan.startsAt ? plan.startsAt.toISOString() : null,
      topics: topics?.value ?? 0,
      initiatives: initiatives?.value ?? 0,
    };
  }
}
