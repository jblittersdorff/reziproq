import { and, eq, inArray, schema, sql, type TenantTransaction } from '@reziproq/db';
import type { EffectTotal, EffectType, InitiativeShare } from '@reziproq/shared';
import { effectTypes } from '@reziproq/shared';

// PNL-07: Teilung, Summen je Wirkungsart und Savings-Verweise. Hilfen für Käufer und Lieferant.

export function shareOf(row: typeof schema.initiativeShare.$inferSelect): InitiativeShare {
  return {
    id: row.id,
    buyerSharePct: row.buyerSharePct,
    supplierSharePct: row.supplierSharePct,
    ruleText: row.ruleText,
    proposedByName: row.proposedByName,
    proposedAt: row.proposedAt.toISOString(),
    supplierConfirmedByName: row.supplierConfirmedByName,
    agreedAt: row.agreedAt?.toISOString() ?? null,
  };
}

/** Teilungen der Initiativen, die die Session sieht (geteilte Zeilen). */
export async function sharesOf(tx: TenantTransaction, initiativeIds: string[]) {
  if (initiativeIds.length === 0) return new Map<string, InitiativeShare>();
  const rows = await tx
    .select()
    .from(schema.initiativeShare)
    .where(
      and(
        inArray(schema.initiativeShare.initiativeId, initiativeIds),
        eq(schema.initiativeShare.visibility, 'shared'),
      ),
    );
  return new Map(rows.map((row) => [row.initiativeId, shareOf(row)]));
}

/**
 * Summen von Plan und Ist je Initiative und Wirkungsart aus initiative_value. Jede Initiative hat
 * genau eine Wirkungsart; über Arten hinweg wird nie addiert.
 */
export async function valuesOf(tx: TenantTransaction, initiativeIds: string[]) {
  if (initiativeIds.length === 0) return new Map<string, EffectTotal>();
  const rows = await tx
    .select({
      initiativeId: schema.initiativeValue.initiativeId,
      effectType: schema.initiativeValue.effectType,
      kind: schema.initiativeValue.kind,
      total: sql<string>`sum(${schema.initiativeValue.valueCents})::text`,
    })
    .from(schema.initiativeValue)
    .where(inArray(schema.initiativeValue.initiativeId, initiativeIds))
    .groupBy(
      schema.initiativeValue.initiativeId,
      schema.initiativeValue.effectType,
      schema.initiativeValue.kind,
    );
  const result = new Map<string, EffectTotal>();
  for (const row of rows) {
    const entry = result.get(row.initiativeId) ?? {
      effectType: row.effectType as EffectType,
      plan: 0,
      actual: 0,
    };
    entry[row.kind] += Number(row.total);
    result.set(row.initiativeId, entry);
  }
  return result;
}

/** Je Wirkungsart eine Summe über die gezählten Initiativen, in fester Reihenfolge. */
export function totalsOf(values: EffectTotal[]): EffectTotal[] {
  return effectTypes.flatMap((effectType) => {
    const matching = values.filter((value) => value.effectType === effectType);
    if (matching.length === 0) return [];
    return [
      {
        effectType,
        plan: matching.reduce((sum, value) => sum + value.plan, 0),
        actual: matching.reduce((sum, value) => sum + value.actual, 0),
      },
    ];
  });
}

/** Savings-Verweise des Käufers (käuferprivat). */
export async function referencesOf(tx: TenantTransaction, initiativeIds: string[]) {
  if (initiativeIds.length === 0) return new Map<string, { system: string; reference: string }>();
  const rows = await tx
    .select({
      initiativeId: schema.savingsReference.initiativeId,
      system: schema.savingsReference.system,
      reference: schema.savingsReference.reference,
    })
    .from(schema.savingsReference)
    .where(inArray(schema.savingsReference.initiativeId, initiativeIds));
  return new Map(
    rows.map((row) => [row.initiativeId, { system: row.system, reference: row.reference }]),
  );
}
