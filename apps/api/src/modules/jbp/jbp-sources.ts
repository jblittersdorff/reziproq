import {
  and,
  asc,
  currentTime,
  desc,
  eq,
  inArray,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import { kpiTrack, type LiveSection, type OverviewMetric } from '@reziproq/shared';
import type { AuthContext } from '../auth/auth.guard.js';
import type { MeetingLiveSource } from '../meetings/live-sections.js';
import type { OverviewMetricSource } from '../overview/overview-metric.js';
import { kpiTolerance, valuesOf } from './jbp-scorecard.service.js';

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
    const today = currentTime().toISOString().slice(0, 10);
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

/**
 * Live-Abschnitt im Termin (QBR-01, JBP-09): Kennzahlen der Scorecard mit Stand „auf Kurs“ aus den
 * Ist-Werten. Status ist on_track, close, off oder none (noch kein Wert).
 */
export class ScorecardLiveSource implements MeetingLiveSource {
  readonly key = 'scorecard';
  async read(tx: TenantTransaction, relationshipId: string): Promise<LiveSection | null> {
    const [plan] = await tx
      .select({ id: schema.jbp.id })
      .from(schema.jbp)
      .where(eq(schema.jbp.relationshipId, relationshipId))
      .orderBy(desc(schema.jbp.version))
      .limit(1);
    if (!plan) return null;
    const kpis = await tx
      .select({
        id: schema.scorecardKpi.id,
        name: schema.scorecardKpi.name,
        baseline: schema.scorecardKpi.baseline,
        target: schema.scorecardKpi.target,
        direction: schema.scorecardKpi.direction,
        unit: schema.scorecardKpi.unit,
        targetDate: schema.scorecardKpi.targetDate,
        createdAt: schema.scorecardKpi.createdAt,
      })
      .from(schema.scorecardKpi)
      .innerJoin(schema.scorecard, eq(schema.scorecard.id, schema.scorecardKpi.scorecardId))
      .where(eq(schema.scorecard.jbpId, plan.id))
      .orderBy(asc(schema.scorecardKpi.createdAt));
    if (kpis.length === 0) return null;
    const tolerance = await kpiTolerance(tx, relationshipId);
    const values = await valuesOf(
      tx,
      kpis.map((kpi) => kpi.id),
    );
    return {
      key: this.key,
      items: kpis.map((kpi) => {
        const startDate = kpi.createdAt.toISOString().slice(0, 10);
        const own = values
          .filter((entry) => entry.kpiId === kpi.id)
          .map((entry) => ({ period: entry.period, value: entry.value }));
        // Letzter Ist-Wert mit Einheit und Zeitraum, z. B. „94 % (2026-10)“ (QBR-06)
        const last = own.at(-1);
        return {
          id: kpi.id,
          title: kpi.name,
          status: kpiTrack({ ...kpi, startDate }, own, tolerance) ?? 'none',
          dueDate: kpi.targetDate,
          detail: last ? `${Number(last.value)} ${kpi.unit} (${last.period})` : null,
        };
      }),
    };
  }
}

/**
 * Live-Abschnitt im Termin (QBR-06): Initiativen des aktuellen Plans mit Status, aus ihrem Ort
 * gelesen. Interne Initiativen sieht nur die eigene Seite (RLS).
 */
export class InitiativesLiveSource implements MeetingLiveSource {
  readonly key = 'initiatives';
  async read(tx: TenantTransaction, relationshipId: string): Promise<LiveSection | null> {
    const [plan] = await tx
      .select({ id: schema.jbp.id })
      .from(schema.jbp)
      .where(eq(schema.jbp.relationshipId, relationshipId))
      .orderBy(desc(schema.jbp.version))
      .limit(1);
    if (!plan) return null;
    const rows = await tx
      .select({
        id: schema.initiative.id,
        title: schema.initiative.title,
        status: schema.initiative.status,
        endsOn: schema.initiative.endsOn,
      })
      .from(schema.initiative)
      .where(eq(schema.initiative.jbpId, plan.id))
      .orderBy(asc(schema.initiative.startsOn), asc(schema.initiative.title));
    if (rows.length === 0) return null;
    return {
      key: this.key,
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        dueDate: row.endsOn,
        detail: null,
      })),
    };
  }
}
