import { and, desc, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import type { OverviewFigures } from '@reziproq/shared';
import { topGapOf } from '../feedback/results.js';

const basisPoints = (part: number, whole: number) =>
  whole > 0 ? Math.round((part * 10_000) / whole) : null;

/**
 * Kennzahlen des Lieferanten-Überblicks (NAV-10 1.1): liest jeden Wert an seinem Ursprung, nur in
 * der Mandanten-Session des Käufers. Fehlen Daten, ist die Angabe null statt geschätzt.
 */
export async function overviewFigures(
  tx: TenantTransaction,
  orgId: string,
  relationshipId: string,
  options: { feedback: boolean },
): Promise<OverviewFigures> {
  return {
    spend: await spendFigure(tx, relationshipId),
    groupShare: await groupShareFigure(tx, orgId, relationshipId),
    feedbackGap: options.feedback ? await feedbackGapFigure(tx, relationshipId) : null,
  };
}

/** Ist-Spend des jüngsten Jahres und die Veränderung zum Vorjahr in derselben Währung */
async function spendFigure(tx: TenantTransaction, relationshipId: string) {
  const total = schema.relationshipSpendTotal;
  const rows = await tx
    .select({ year: total.year, currency: total.currency, amountCents: total.amountCents })
    .from(total)
    .where(eq(total.relationshipId, relationshipId))
    .orderBy(desc(total.year));
  const [last] = rows;
  if (!last) return null;
  const previous = rows.find((row) => row.year === last.year - 1 && row.currency === last.currency);
  return {
    year: last.year,
    amount: { amountCents: last.amountCents, currency: last.currency },
    changeBasisPoints: previous
      ? basisPoints(last.amountCents - previous.amountCents, previous.amountCents)
      : null,
  };
}

/**
 * Anteil am Ist-Spend der Haupt-Warengruppe im jüngsten Jahr, in dem der Lieferant dort Spend hat:
 * eigene Zeilen dieser Warengruppe durch die Zeilen aller Lieferanten der Organisation. Nur bei
 * einheitlicher Währung.
 */
async function groupShareFigure(tx: TenantTransaction, orgId: string, relationshipId: string) {
  const [primary] = await tx
    .select({ id: schema.materialGroup.id, name: schema.materialGroup.name })
    .from(schema.relationshipMaterialGroup)
    .innerJoin(
      schema.materialGroup,
      eq(schema.materialGroup.id, schema.relationshipMaterialGroup.materialGroupId),
    )
    .where(
      and(
        eq(schema.relationshipMaterialGroup.relationshipId, relationshipId),
        eq(schema.relationshipMaterialGroup.isPrimary, true),
      ),
    );
  if (!primary) return null;
  const s = schema.relationshipSpend;
  const [own] = await tx
    .select({ year: sql<number>`max(${s.year})::int` })
    .from(s)
    .where(
      and(
        eq(s.relationshipId, relationshipId),
        eq(s.materialGroupId, primary.id),
        eq(s.kind, 'actual'),
      ),
    );
  const year = own?.year ?? null;
  if (year === null) return null;
  const rows = await tx
    .select({
      relationshipId: s.relationshipId,
      currency: s.currency,
      amountCents: sql<number>`sum(${s.amountCents})::bigint`.mapWith(Number),
    })
    .from(s)
    .innerJoin(schema.relationship, eq(schema.relationship.id, s.relationshipId))
    .where(
      and(
        eq(schema.relationship.buyerOrgId, orgId),
        eq(s.materialGroupId, primary.id),
        eq(s.kind, 'actual'),
        eq(s.year, year),
      ),
    )
    .groupBy(s.relationshipId, s.currency);
  if (new Set(rows.map((row) => row.currency)).size !== 1) return null;
  const whole = rows.reduce((sum, row) => sum + row.amountCents, 0);
  const part = rows
    .filter((row) => row.relationshipId === relationshipId)
    .reduce((sum, row) => sum + row.amountCents, 0);
  const share = basisPoints(part, whole);
  return share === null ? null : { group: primary.name, year, basisPoints: share };
}

/** Größte Lücke der zuletzt aufgedeckten Welle (PUL-03), wie in der Supplier Map (WG-15) */
async function feedbackGapFigure(tx: TenantTransaction, relationshipId: string) {
  const [wave] = await tx
    .select({ id: schema.surveyWave.id })
    .from(schema.surveyWave)
    .where(
      and(
        eq(schema.surveyWave.relationshipId, relationshipId),
        sql`${schema.surveyWave.revealedAt} is not null`,
      ),
    )
    .orderBy(desc(schema.surveyWave.revealedAt))
    .limit(1);
  return wave ? await topGapOf(tx, wave.id) : null;
}
