import { randomUUID } from 'node:crypto';
import { eq, schema, type TenantTransaction } from '@reziproq/db';

type StrategyRow = typeof schema.materialGroupStrategy.$inferSelect;

/**
 * WG-16: Kopiert die Inhalte einer Strategie in eine neue (neue Version oder Entwurf für das
 * Folgejahr). Übernommen werden Beobachtungen, Meilensteine, Ziele, Sichten, Kandidaten, Marktkräfte,
 * Profil, Paarungen, Initiativen, Supplier Map, Vergaben und die Zusammenfassung (als Entwurf). Nicht
 * übernommen: Zuweisungen und Kommentare der Sichten, Reviews, Unterschriften und Protokolle der KI.
 * Verweise zwischen den Tabellen zeigen danach auf die neuen Zeilen.
 */
export async function copyStrategyContent(
  tx: TenantTransaction,
  from: StrategyRow,
  to: StrategyRow,
) {
  const ids = new Map<string, string>();
  const next = (id: string) => {
    const fresh = randomUUID();
    ids.set(id, fresh);
    return fresh;
  };
  const mapped = (id: string | null) => (id === null ? null : (ids.get(id) ?? null));
  const base = { strategyId: to.id };

  const notes = await tx
    .select()
    .from(schema.materialGroupNote)
    .where(eq(schema.materialGroupNote.strategyId, from.id));
  if (notes.length) {
    await tx
      .insert(schema.materialGroupNote)
      .values(notes.map((row) => ({ ...row, ...base, id: next(row.id) })));
  }
  const milestones = await tx
    .select()
    .from(schema.materialGroupMilestone)
    .where(eq(schema.materialGroupMilestone.strategyId, from.id));
  if (milestones.length) {
    await tx
      .insert(schema.materialGroupMilestone)
      .values(milestones.map((row) => ({ ...row, ...base, id: next(row.id) })));
  }
  const goals = await tx
    .select()
    .from(schema.materialGroupGoal)
    .where(eq(schema.materialGroupGoal.strategyId, from.id));
  if (goals.length) {
    await tx
      .insert(schema.materialGroupGoal)
      .values(goals.map((row) => ({ ...row, ...base, id: next(row.id) })));
  }
  const analyses = await tx
    .select()
    .from(schema.materialGroupAnalysis)
    .where(eq(schema.materialGroupAnalysis.strategyId, from.id));
  if (analyses.length) {
    await tx
      .insert(schema.materialGroupAnalysis)
      .values(analyses.map((row) => ({ ...row, ...base, id: next(row.id) })));
  }
  const candidates = await tx
    .select()
    .from(schema.materialGroupCandidate)
    .where(eq(schema.materialGroupCandidate.strategyId, from.id));
  if (candidates.length) {
    await tx
      .insert(schema.materialGroupCandidate)
      .values(candidates.map((row) => ({ ...row, ...base, id: next(row.id) })));
  }
  const forces = await tx
    .select()
    .from(schema.materialGroupMarketForce)
    .where(eq(schema.materialGroupMarketForce.strategyId, from.id));
  if (forces.length) {
    await tx
      .insert(schema.materialGroupMarketForce)
      .values(forces.map((row) => ({ ...row, ...base, id: next(row.id) })));
  }
  const swot = await tx
    .select()
    .from(schema.materialGroupSwotItem)
    .where(eq(schema.materialGroupSwotItem.strategyId, from.id));
  if (swot.length) {
    await tx
      .insert(schema.materialGroupSwotItem)
      .values(swot.map((row) => ({ ...row, ...base, id: next(row.id) })));
  }
  const choices = await tx
    .select()
    .from(schema.materialGroupLeverChoice)
    .where(eq(schema.materialGroupLeverChoice.strategyId, from.id));
  const keptChoices = choices.filter(
    (row) => ids.has(row.internalItemId) && ids.has(row.externalItemId),
  );
  if (keptChoices.length) {
    await tx.insert(schema.materialGroupLeverChoice).values(
      keptChoices.map((row) => ({
        ...row,
        ...base,
        id: next(row.id),
        internalItemId: mapped(row.internalItemId) as string,
        externalItemId: mapped(row.externalItemId) as string,
      })),
    );
  }
  const initiatives = await tx
    .select()
    .from(schema.materialGroupInitiative)
    .where(eq(schema.materialGroupInitiative.strategyId, from.id));
  const keptInitiatives = initiatives.filter(
    (row) => ids.has(row.goalId) && ids.has(row.leverChoiceId),
  );
  if (keptInitiatives.length) {
    await tx.insert(schema.materialGroupInitiative).values(
      keptInitiatives.map((row) => ({
        ...row,
        ...base,
        id: next(row.id),
        goalId: mapped(row.goalId) as string,
        leverChoiceId: mapped(row.leverChoiceId) as string,
      })),
    );
  }
  const initiativeSuppliers = await tx
    .select()
    .from(schema.materialGroupInitiativeSupplier)
    .where(eq(schema.materialGroupInitiativeSupplier.strategyId, from.id));
  const keptLinks = initiativeSuppliers.filter((row) => ids.has(row.initiativeId));
  if (keptLinks.length) {
    await tx.insert(schema.materialGroupInitiativeSupplier).values(
      keptLinks.map((row) => ({
        ...row,
        ...base,
        id: randomUUID(),
        initiativeId: mapped(row.initiativeId) as string,
      })),
    );
  }
  const mapRows = await tx
    .select()
    .from(schema.materialGroupSupplierMapRow)
    .where(eq(schema.materialGroupSupplierMapRow.strategyId, from.id));
  if (mapRows.length) {
    await tx
      .insert(schema.materialGroupSupplierMapRow)
      .values(mapRows.map((row) => ({ ...row, ...base, id: randomUUID() })));
  }
  const awards = await tx
    .select()
    .from(schema.materialGroupAward)
    .where(eq(schema.materialGroupAward.strategyId, from.id));
  if (awards.length) {
    await tx
      .insert(schema.materialGroupAward)
      .values(awards.map((row) => ({ ...row, ...base, id: next(row.id) })));
  }
  const awardSuppliers = await tx
    .select()
    .from(schema.materialGroupAwardSupplier)
    .where(eq(schema.materialGroupAwardSupplier.strategyId, from.id));
  const keptAwardSuppliers = awardSuppliers.filter(
    (row) => ids.has(row.awardId) && (row.candidateId === null || ids.has(row.candidateId)),
  );
  if (keptAwardSuppliers.length) {
    await tx.insert(schema.materialGroupAwardSupplier).values(
      keptAwardSuppliers.map((row) => ({
        ...row,
        ...base,
        id: randomUUID(),
        awardId: mapped(row.awardId) as string,
        candidateId: mapped(row.candidateId),
      })),
    );
  }
  const [summary] = await tx
    .select()
    .from(schema.materialGroupSummary)
    .where(eq(schema.materialGroupSummary.strategyId, from.id));
  if (summary) {
    await tx.insert(schema.materialGroupSummary).values({
      ...summary,
      ...base,
      id: randomUUID(),
      status: 'draft',
      submitted: null,
    });
  }
}
