import {
  and,
  currentTime,
  desc,
  eq,
  gte,
  inArray,
  or,
  schema,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type CycleScheduleStep,
  type CycleStepKey,
  type CycleStepStatus,
  calculateCycleDeadlines,
  cycleStepKeys,
  defaultCycleSettings,
  type SupplierCycle,
} from '@reziproq/shared';

export interface CycleStepContext {
  id: string;
  relationshipId: string;
  label: string;
  startedAt: Date;
  jbpDate: string | null;
  status: 'active' | 'closed';
}

export interface CycleStepSource {
  key: CycleStepKey;
  cycleStepStatus(cycle: CycleStepContext, tx: TenantTransaction): Promise<CycleStepStatus>;
}

export const CYCLE_STEP_SOURCES = Symbol('CYCLE_STEP_SOURCES');

/** SPL-07: Lieferantenplan erledigt, sobald eine Version im Zyklus freigegeben ist. */
export const supplierPlanCycleStepSource: CycleStepSource = {
  key: 'supplierPlan',
  async cycleStepStatus(cycle, tx) {
    const plans = await tx
      .select({ status: schema.supplierPlan.status })
      .from(schema.supplierPlan)
      .where(eq(schema.supplierPlan.cycleId, cycle.id));
    if (plans.some((plan) => plan.status === 'approved' || plan.status === 'superseded')) {
      return 'completed';
    }
    return plans.length > 0 ? 'in_progress' : 'open';
  },
};

/**
 * JBP-06: Gemeinsamer Plan erledigt, sobald eine Version des Plans dieses Zyklus von beiden Seiten
 * freigegeben ist; begonnen, sobald der Plan angelegt ist. Der Verweis auf den Zyklus ist
 * käuferprivat (jbp_cycle_link), passend zur Zyklus-Leiste des Käufers.
 */
export const jbpCycleStepSource: CycleStepSource = {
  key: 'jbp',
  async cycleStepStatus(cycle, tx) {
    const plans = await tx
      .select({ id: schema.jbpCycleLink.jbpId })
      .from(schema.jbpCycleLink)
      .where(eq(schema.jbpCycleLink.cycleId, cycle.id));
    if (plans.length === 0) return 'open';
    // Nur Freigaben in diesem Zyklus: Läuft der Plan weiter (ZYK-05), zählt die alte nicht.
    const [approved] = await tx
      .select({ id: schema.jbpVersion.id })
      .from(schema.jbpVersion)
      .where(
        and(
          inArray(
            schema.jbpVersion.jbpId,
            plans.map((plan) => plan.id),
          ),
          gte(schema.jbpVersion.approvedAt, cycle.startedAt),
        ),
      )
      .limit(1);
    return approved ? 'completed' : 'in_progress';
  },
};

/** JBP-07: Scorecard erledigt, sobald beide Seiten die Scorecard des Plans unterschrieben haben. */
export const scorecardCycleStepSource: CycleStepSource = {
  key: 'scorecard',
  async cycleStepStatus(cycle, tx) {
    const plans = await tx
      .select({ id: schema.jbpCycleLink.jbpId })
      .from(schema.jbpCycleLink)
      .where(eq(schema.jbpCycleLink.cycleId, cycle.id));
    if (plans.length === 0) return 'open';
    const cards = await tx
      .select({ id: schema.scorecard.id, status: schema.scorecard.status })
      .from(schema.scorecard)
      .where(
        inArray(
          schema.scorecard.jbpId,
          plans.map((plan) => plan.id),
        ),
      );
    // Nur Unterschriften in diesem Zyklus zählen (ZYK-05): Die Scorecard des Vorjahrs erledigt
    // den Schritt nicht.
    const signed = cards.filter((card) => card.status === 'signed');
    if (signed.length > 0) {
      const [recent] = await tx
        .select({ id: schema.scorecardSignature.id })
        .from(schema.scorecardSignature)
        .where(
          and(
            inArray(
              schema.scorecardSignature.scorecardId,
              signed.map((card) => card.id),
            ),
            gte(schema.scorecardSignature.signedAt, cycle.startedAt),
          ),
        )
        .limit(1);
      if (recent) return 'completed';
    }
    return cards.length > 0 ? 'in_progress' : 'open';
  },
};

/**
 * PUL-03: Feedback erledigt, sobald eine Welle aus diesem Zyklus aufgedeckt ist; begonnen, sobald
 * eine Welle läuft. Wellen hängen nicht am Zyklus, deshalb zählt der Start nach Zyklusbeginn.
 */
export const feedbackCycleStepSource: CycleStepSource = {
  key: 'feedback',
  async cycleStepStatus(cycle, tx) {
    const waves = await tx
      .select({ revealedAt: schema.surveyWave.revealedAt })
      .from(schema.surveyWave)
      .where(
        and(
          eq(schema.surveyWave.relationshipId, cycle.relationshipId),
          gte(schema.surveyWave.createdAt, cycle.startedAt),
        ),
      );
    if (waves.some((wave) => wave.revealedAt !== null)) return 'completed';
    return waves.length > 0 ? 'in_progress' : 'open';
  },
};

/**
 * PLB-06: Kontaktpunkte erledigt, sobald sie in diesem Zyklus als geprüft markiert sind; begonnen,
 * sobald es Kontaktpunkte gibt.
 */
export const touchpointCycleStepSource: CycleStepSource = {
  key: 'touchpoints',
  async cycleStepStatus(cycle, tx) {
    const [review] = await tx
      .select({ id: schema.touchpointReview.id })
      .from(schema.touchpointReview)
      .where(eq(schema.touchpointReview.cycleId, cycle.id));
    if (review) return 'completed';
    const [any] = await tx
      .select({ id: schema.touchpoint.id })
      .from(schema.touchpoint)
      .where(eq(schema.touchpoint.relationshipId, cycle.relationshipId))
      .limit(1);
    return any ? 'in_progress' : 'open';
  },
};

/** Wohin ein Schritt der Zyklus-Leiste führt, sobald sein Modul gebaut ist. */
const stepPaths: Partial<Record<CycleStepKey, string>> = {
  segment: 'strategie/segmentierung',
  feedback: 'beziehung/feedback',
  touchpoints: 'beziehung/kontaktpunkte',
  supplierPlan: 'strategie/lieferantenplan',
  jbp: 'plan/freigabe',
  scorecard: 'plan/scorecard',
};

export async function readCycleSettings(tx: TenantTransaction) {
  const rows = await tx.select().from(schema.cycleSetting);
  const stored = new Map(rows.map((row) => [row.step, row]));
  return defaultCycleSettings.map((defaults) => {
    const setting = stored.get(defaults.step);
    return {
      step: defaults.step,
      weeksRelativeToJbp: setting?.weeksRelativeToJbp ?? defaults.weeksRelativeToJbp,
      reminderDaysBefore: setting?.reminderDaysBefore ?? defaults.reminderDaysBefore,
    };
  });
}

export const segmentCycleStepSource: CycleStepSource = {
  key: 'segment',
  async cycleStepStatus(cycle, tx) {
    const twelveMonthsAgo = currentTime();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const decisions = await tx
      .select({ id: schema.segmentDecision.id })
      .from(schema.segmentDecision)
      .where(
        and(
          eq(schema.segmentDecision.relationshipId, cycle.relationshipId),
          eq(schema.segmentDecision.scope, 'total'),
          or(
            gte(schema.segmentDecision.decidedAt, cycle.startedAt),
            gte(schema.segmentDecision.decidedAt, twelveMonthsAgo),
          ),
        ),
      )
      .limit(1);
    return decisions.length > 0 ? 'completed' : 'open';
  },
};

export async function ensureActiveCycle(tx: TenantTransaction, relationshipId: string) {
  const [existing] = await tx
    .select()
    .from(schema.cycle)
    .where(and(eq(schema.cycle.relationshipId, relationshipId), eq(schema.cycle.status, 'active')))
    .orderBy(desc(schema.cycle.startedAt))
    .limit(1);
  if (existing) return existing;

  const startedAt = currentTime();
  await tx
    .insert(schema.cycle)
    .values({
      relationshipId,
      label: String(startedAt.getFullYear()),
      startedAt,
    })
    .onConflictDoNothing();

  const [created] = await tx
    .select()
    .from(schema.cycle)
    .where(and(eq(schema.cycle.relationshipId, relationshipId), eq(schema.cycle.status, 'active')))
    .orderBy(desc(schema.cycle.startedAt))
    .limit(1);
  if (!created) throw new Error('Zyklus konnte nicht angelegt werden');
  return created;
}

export async function readActiveCycle(
  tx: TenantTransaction,
  relationshipId: string,
  cycleStepSources: CycleStepSource[],
): Promise<SupplierCycle | null> {
  const [cycle] = await tx
    .select()
    .from(schema.cycle)
    .where(and(eq(schema.cycle.relationshipId, relationshipId), eq(schema.cycle.status, 'active')))
    .orderBy(desc(schema.cycle.startedAt))
    .limit(1);
  if (!cycle) return null;

  const schedule = calculateCycleDeadlines(cycle.jbpDate, await readCycleSettings(tx));
  const deadlines = new Map(
    schedule.map(({ step, dueDate }): [CycleScheduleStep, string | null] => [step, dueDate]),
  );
  const today = currentTime().toISOString().slice(0, 10);

  return {
    id: cycle.id,
    label: cycle.label,
    startedAt: cycle.startedAt.toISOString(),
    jbpDate: cycle.jbpDate,
    schedule,
    steps: await Promise.all(
      cycleStepKeys.map(async (key) => {
        const status =
          (await cycleStepSources
            .find((source) => source.key === key)
            ?.cycleStepStatus(cycle, tx)) ?? 'unavailable';
        const dueDate = deadlines.get(key as CycleScheduleStep) ?? null;
        return {
          key,
          status: dueDate && dueDate < today && status !== 'completed' ? 'overdue' : status,
          href: stepPaths[key] ? `/lieferanten/${relationshipId}/${stepPaths[key]}` : null,
          dueDate,
        };
      }),
    ),
  };
}
