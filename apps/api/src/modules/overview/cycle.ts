import { and, desc, eq, gte, or, schema, type TenantTransaction } from '@reziproq/db';
import {
  calculateCycleDeadlines,
  defaultCycleSettings,
  type CycleStepKey,
  type CycleScheduleStep,
  type CycleStepStatus,
  cycleStepKeys,
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
    const twelveMonthsAgo = new Date();
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

  const startedAt = new Date();
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

  const href = `/lieferanten/${relationshipId}/strategie/segmentierung`;
  const schedule = calculateCycleDeadlines(cycle.jbpDate, await readCycleSettings(tx));
  const deadlines = new Map(
    schedule.map(({ step, dueDate }): [CycleScheduleStep, string | null] => [step, dueDate]),
  );
  const today = new Date().toISOString().slice(0, 10);

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
          href: key === 'segment' ? href : null,
          dueDate,
        };
      }),
    ),
  };
}
