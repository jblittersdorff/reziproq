import { and, asc, desc, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import type { ImpactMonth, Validation } from '@reziproq/shared';

// PNL-05, PNL-06: Monate mit Eingaben und berechneten Beträgen, gesperrte Zeiträume, Freigaben.

/** Neu rechnen lässt nur die Funktion app_initiative_recompute (Migration 0052). */
export async function recompute(tx: TenantTransaction, initiativeId: string) {
  await tx.execute(sql`select app_initiative_recompute(${initiativeId})`);
}

/** Zeiträume, die Controlling freigegeben hat; ihre Monate sind gesperrt. */
export async function lockedPeriods(tx: TenantTransaction, initiativeId: string) {
  return tx
    .select({
      from: schema.initiativeValidation.periodFrom,
      to: schema.initiativeValidation.periodTo,
    })
    .from(schema.initiativeValidation)
    .where(
      and(
        eq(schema.initiativeValidation.initiativeId, initiativeId),
        eq(schema.initiativeValidation.status, 'approved'),
      ),
    );
}

export const isLocked = (periods: { from: string; to: string }[], month: string) =>
  periods.some((period) => month >= period.from && month <= period.to);

/**
 * Je Monat die jüngste Eingabe für Plan und Ist mit dem berechneten Betrag, älteste Monate zuerst;
 * dazu die Summen. Ein Zeitraum filtert die Monate (Prüfseite PNL-06).
 */
export async function monthsOf(
  tx: TenantTransaction,
  initiativeId: string,
  period?: { from: string; to: string },
) {
  const inputs = await tx
    .select()
    .from(schema.initiativeInputMonth)
    .where(eq(schema.initiativeInputMonth.initiativeId, initiativeId))
    .orderBy(asc(schema.initiativeInputMonth.month), desc(schema.initiativeInputMonth.enteredAt));
  const values = await tx
    .select()
    .from(schema.initiativeValue)
    .where(eq(schema.initiativeValue.initiativeId, initiativeId));
  const periods = await lockedPeriods(tx, initiativeId);
  const byMonth = new Map<string, ImpactMonth>();
  for (const row of inputs) {
    if (period && (row.month < period.from || row.month > period.to)) continue;
    const entry = byMonth.get(row.month) ?? {
      month: row.month,
      plan: null,
      actual: null,
      locked: isLocked(periods, row.month),
    };
    if (entry[row.kind]) continue;
    const value = values.find((item) => item.month === row.month && item.kind === row.kind);
    entry[row.kind] = {
      inputs: row.inputs as Record<string, string>,
      amountCents: value ? Number(value.valueCents) : null,
      enteredByName: row.enteredByName,
      source: row.source,
    };
    byMonth.set(row.month, entry);
  }
  const months = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  const total = (kind: 'plan' | 'actual') =>
    months.reduce((sum, month) => sum + (month[kind]?.amountCents ?? 0), 0);
  return { months, totals: { plan: total('plan'), actual: total('actual') } };
}

/** Freigaben mit Lieferant und Initiative; in der Session des Käufers. */
export async function validationsOf(
  tx: TenantTransaction,
  where: { initiativeId?: string; id?: string; status?: 'requested' },
): Promise<Validation[]> {
  const name = sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`;
  const rows = await tx
    .select({
      validation: schema.initiativeValidation,
      initiative: schema.initiative.title,
      supplier: name,
    })
    .from(schema.initiativeValidation)
    .innerJoin(
      schema.initiative,
      eq(schema.initiative.id, schema.initiativeValidation.initiativeId),
    )
    .innerJoin(
      schema.relationship,
      eq(schema.relationship.id, schema.initiativeValidation.relationshipId),
    )
    .innerJoin(schema.organization, eq(schema.organization.id, schema.relationship.supplierOrgId))
    .leftJoin(
      schema.relationshipSide,
      and(
        eq(schema.relationshipSide.relationshipId, schema.relationship.id),
        eq(schema.relationshipSide.orgId, schema.relationship.buyerOrgId),
      ),
    )
    .where(
      and(
        where.initiativeId
          ? eq(schema.initiativeValidation.initiativeId, where.initiativeId)
          : undefined,
        where.id ? eq(schema.initiativeValidation.id, where.id) : undefined,
        where.status ? eq(schema.initiativeValidation.status, where.status) : undefined,
      ),
    )
    .orderBy(desc(schema.initiativeValidation.requestedAt));
  return rows.map(({ validation, initiative, supplier }) => ({
    id: validation.id,
    relationshipId: validation.relationshipId,
    supplier,
    initiativeId: validation.initiativeId,
    initiative,
    periodFrom: validation.periodFrom,
    periodTo: validation.periodTo,
    status: validation.status,
    requestedByName: validation.requestedByName,
    requestedAt: validation.requestedAt.toISOString(),
    decidedByName: validation.decidedByName,
    decidedAt: validation.decidedAt?.toISOString() ?? null,
    comment: validation.comment,
  }));
}
