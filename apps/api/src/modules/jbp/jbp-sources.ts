import { and, asc, desc, eq, inArray, schema, sql, type TenantTransaction } from '@reziproq/db';
import type { LiveSection, OverviewMetric } from '@reziproq/shared';
import type { AuthContext } from '../auth/auth.guard.js';
import type { MeetingLiveSource } from '../meetings/live-sections.js';
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

/** Live-Abschnitt im Termin (QBR-01, JBP-05): offene Zusagen beider Seiten, aus ihrem Ort gelesen. */
export class CommitmentsLiveSource implements MeetingLiveSource {
  readonly key = 'commitments';
  async read(tx: TenantTransaction, relationshipId: string): Promise<LiveSection | null> {
    const [plan] = await tx
      .select({ id: schema.jbp.id })
      .from(schema.jbp)
      .where(eq(schema.jbp.relationshipId, relationshipId))
      .orderBy(desc(schema.jbp.version))
      .limit(1);
    if (!plan) return null;
    const today = new Date().toISOString().slice(0, 10);
    const rows = await tx
      .select({
        id: schema.commitment.id,
        title: schema.commitment.title,
        status: schema.commitment.status,
        dueOn: schema.commitment.dueOn,
      })
      .from(schema.commitment)
      .where(and(eq(schema.commitment.jbpId, plan.id), eq(schema.commitment.status, 'open')))
      .orderBy(asc(schema.commitment.dueOn));
    return {
      key: this.key,
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.dueOn < today ? 'overdue' : row.status,
        dueDate: row.dueOn,
      })),
    };
  }
}
