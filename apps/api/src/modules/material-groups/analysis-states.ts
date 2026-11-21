import { and, desc, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  type AnalysisViewKey,
  internalViews,
  type StepState,
  supplierViews,
} from '@reziproq/shared';

interface NoteRow {
  step: number;
  view: string;
  text: string;
  notApplicable: boolean;
}

/**
 * WG-07: Eine Sicht ist fertig, wenn ihre Beobachtung ausgefüllt ist; als nicht anwendbar markiert
 * zählt sie mit Begründung (die Begründung ist der Text). In Arbeit, sobald Daten oder Text da sind.
 */
export function viewState(
  view: AnalysisViewKey,
  notes: NoteRow[],
  withData: Set<string>,
): StepState {
  const note = notes.find((entry) => entry.view === view);
  if (note && note.text.trim().length > 0) return 'done';
  return withData.has(view) || note ? 'in_progress' : 'open';
}

/** Stand eines Schritts aus dem Stand seiner Sichten; Schritt 4 zusätzlich mit der Runde. */
export function stepState(states: StepState[], extraDone = true, extraStarted = false): StepState {
  if (states.every((state) => state === 'done') && extraDone) return 'done';
  return states.some((state) => state !== 'open') || extraStarted ? 'in_progress' : 'open';
}

/**
 * Bewertungsrunde der Warengruppe entschieden (WG-18): Es gibt eine Runde, und jeder Lieferant der
 * jüngsten Runde hat seit ihrem Start eine Entscheidung in der Warengruppe.
 */
export async function categoryRoundState(tx: TenantTransaction, groupId: string) {
  const [round] = await tx
    .select({ id: schema.segmentationRound.id, createdAt: schema.segmentationRound.createdAt })
    .from(schema.segmentationRound)
    .where(
      and(
        eq(schema.segmentationRound.scope, 'category'),
        eq(schema.segmentationRound.materialGroupId, groupId),
      ),
    )
    .orderBy(desc(schema.segmentationRound.createdAt))
    .limit(1);
  if (!round) return { exists: false, decided: false };
  const result = await tx.execute<{ open: number }>(sql`
    select count(*)::int as open from (
      select distinct a.relationship_id from rating_assignment a where a.round_id = ${round.id}
    ) s
    where not exists (
      select 1 from segment_decision d
      where d.relationship_id = s.relationship_id and d.scope = 'category'
        and d.material_group_id = ${groupId} and d.decided_at >= ${round.createdAt}
    )
  `);
  return { exists: true, decided: (result.rows[0]?.open ?? 1) === 0 };
}

export async function analysisStates(
  tx: TenantTransaction,
  strategyId: string,
  groupId: string,
  notes: NoteRow[],
) {
  const rows = await tx
    .select({ view: schema.materialGroupAnalysis.view })
    .from(schema.materialGroupAnalysis)
    .where(eq(schema.materialGroupAnalysis.strategyId, strategyId));
  const withData = new Set(rows.map((row) => row.view as string));
  const of = (step: number) => notes.filter((note) => note.step === step);
  const internal = internalViews.map((view) => viewState(view, of(3), withData));
  const external = supplierViews.map((view) => viewState(view, of(4), withData));
  const round = await categoryRoundState(tx, groupId);
  return {
    step3: stepState(internal),
    step4: stepState(external, round.decided, round.exists),
    views: Object.fromEntries([
      ...internalViews.map((view, index) => [view, internal[index]]),
      ...supplierViews.map((view, index) => [view, external[index]]),
    ]) as Record<AnalysisViewKey, StepState>,
    round,
  };
}
