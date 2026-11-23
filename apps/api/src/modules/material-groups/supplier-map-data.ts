import { and, asc, desc, eq, inArray, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  lastFullYear,
  type SupplierMapRow,
  type SupplierMapTarget,
  supplierMapComplete,
  topShares,
} from '@reziproq/shared';
import { topGapOf } from '../feedback/results.js';

const supplierName = sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`;

/** Eingestellte Segmente des aktiven Modells aus SEG; ohne aktives Modell keine */
export async function activeSegmentTypes(tx: TenantTransaction, orgId: string) {
  const [model] = await tx
    .select({ id: schema.segmentModel.id, version: schema.segmentModel.version })
    .from(schema.segmentModel)
    .where(and(eq(schema.segmentModel.orgId, orgId), eq(schema.segmentModel.status, 'active')));
  if (!model) return { version: null, types: [] };
  const types = await tx
    .select({
      impactLevel: schema.segmentType.impactLevel,
      qualityLevel: schema.segmentType.qualityLevel,
      name: schema.segmentType.name,
    })
    .from(schema.segmentType)
    .where(eq(schema.segmentType.modelId, model.id))
    .orderBy(desc(schema.segmentType.impactLevel), desc(schema.segmentType.qualityLevel));
  return { version: model.version, types };
}

/** Jüngste Segmententscheidung der Warengruppe je Beziehung (WG-18) */
export async function latestCategoryDecisions(
  tx: TenantTransaction,
  groupId: string,
  relationshipIds: string[],
) {
  if (relationshipIds.length === 0) return new Map<string, CategoryDecision>();
  const d = schema.segmentDecision;
  const rows = await tx
    .selectDistinctOn([d.relationshipId], {
      relationshipId: d.relationshipId,
      version: d.version,
      istImpactLevel: d.istImpactLevel,
      istQualityLevel: d.istQualityLevel,
      sollImpactLevel: d.sollImpactLevel,
      sollQualityLevel: d.sollQualityLevel,
      modelVersion: d.modelVersion,
    })
    .from(d)
    .where(
      and(
        eq(d.scope, 'category'),
        eq(d.materialGroupId, groupId),
        inArray(d.relationshipId, relationshipIds),
      ),
    )
    .orderBy(d.relationshipId, desc(d.version));
  return new Map(rows.map((row) => [row.relationshipId, row]));
}
export type CategoryDecision = {
  relationshipId: string;
  version: number;
  istImpactLevel: number;
  istQualityLevel: number;
  sollImpactLevel: number;
  sollQualityLevel: number;
  modelVersion: number;
};

/**
 * WG-15: Zeilen der Supplier Map. Umsatzanteil Ist aus dem Spend des letzten vollen Jahres der
 * Warengruppe; einzeln die obersten 80 %, der Rest zusammengefasst. Segmentnamen nur aus dem
 * aktiven Modell in SEG: Was dort nicht eingestellt ist, erscheint ohne Namen (null).
 */
export async function supplierMapData(
  tx: TenantTransaction,
  orgId: string,
  strategyId: string,
  groupId: string,
  options: { feedback?: boolean } = {},
) {
  const suppliers = await tx
    .select({ relationshipId: schema.relationship.id, name: supplierName })
    .from(schema.relationshipMaterialGroup)
    .innerJoin(
      schema.relationship,
      eq(schema.relationship.id, schema.relationshipMaterialGroup.relationshipId),
    )
    .innerJoin(schema.organization, eq(schema.organization.id, schema.relationship.supplierOrgId))
    .leftJoin(
      schema.relationshipSide,
      and(
        eq(schema.relationshipSide.relationshipId, schema.relationship.id),
        eq(schema.relationshipSide.orgId, orgId),
      ),
    )
    .where(
      and(
        eq(schema.relationshipMaterialGroup.materialGroupId, groupId),
        eq(schema.relationship.buyerOrgId, orgId),
        sql`${schema.relationship.status} <> 'ended'`,
      ),
    )
    .orderBy(asc(supplierName));
  const ids = suppliers.map((entry) => entry.relationshipId);
  const spendYear = lastFullYear();
  const s = schema.relationshipSpend;
  const spend = ids.length
    ? await tx
        .select({
          relationshipId: s.relationshipId,
          amountCents: sql<number>`sum(${s.amountCents})::bigint`.mapWith(Number),
          currency: sql<string>`min(${s.currency})`,
        })
        .from(s)
        .where(
          and(
            eq(s.materialGroupId, groupId),
            eq(s.kind, 'actual'),
            eq(s.year, spendYear),
            inArray(s.relationshipId, ids),
          ),
        )
        .groupBy(s.relationshipId)
    : [];
  const mapRows = await tx
    .select()
    .from(schema.materialGroupSupplierMapRow)
    .where(eq(schema.materialGroupSupplierMapRow.strategyId, strategyId));
  const decisions = await latestCategoryDecisions(tx, groupId, ids);
  const { types } = await activeSegmentTypes(tx, orgId);
  const nameOf = (impactLevel: number, qualityLevel: number) =>
    types.find((type) => type.impactLevel === impactLevel && type.qualityLevel === qualityLevel)
      ?.name ?? null;

  // Beziehung laut Feedback: letzte aufgedeckte Welle je Beziehung, größte Lücke
  const gaps = new Map<string, SupplierMapRow['feedbackGap']>();
  if (options.feedback !== false && ids.length) {
    const waves = await tx
      .selectDistinctOn([schema.surveyWave.relationshipId], {
        id: schema.surveyWave.id,
        relationshipId: schema.surveyWave.relationshipId,
      })
      .from(schema.surveyWave)
      .where(
        and(
          inArray(schema.surveyWave.relationshipId, ids),
          sql`${schema.surveyWave.revealedAt} is not null`,
        ),
      )
      .orderBy(schema.surveyWave.relationshipId, desc(schema.surveyWave.revealedAt));
    for (const wave of waves) gaps.set(wave.relationshipId, await topGapOf(tx, wave.id));
  }

  const { top, total } = topShares(
    suppliers.map((entry) => ({
      ...entry,
      amountCents:
        spend.find((row) => row.relationshipId === entry.relationshipId)?.amountCents ?? 0,
    })),
    0.8,
    Number.POSITIVE_INFINITY,
  );
  const topIds = new Set(top.map((entry) => entry.relationshipId));
  const rowOf = (entry: { relationshipId: string; name: string; amountCents: number }) => {
    const map = mapRows.find((row) => row.relationshipId === entry.relationshipId);
    const decision = decisions.get(entry.relationshipId);
    const istName = decision ? nameOf(decision.istImpactLevel, decision.istQualityLevel) : null;
    const sollName = decision ? nameOf(decision.sollImpactLevel, decision.sollQualityLevel) : null;
    let segmentTarget: SupplierMapTarget | null = null;
    if (map?.ended) segmentTarget = { kind: 'ended' };
    else if (decision && sollName !== null) {
      segmentTarget = {
        kind: 'segment',
        impactLevel: decision.sollImpactLevel,
        qualityLevel: decision.sollQualityLevel,
        name: sollName,
      };
    }
    const shareTarget = map?.shareTarget ?? null;
    return {
      relationshipId: entry.relationshipId,
      name: entry.name,
      site: map?.site ?? null,
      amountCents: entry.amountCents,
      share: total > 0 ? entry.amountCents / total : 0,
      shareTarget,
      targetYear: map?.targetYear ?? null,
      segmentIst:
        decision && istName !== null
          ? {
              impactLevel: decision.istImpactLevel,
              qualityLevel: decision.istQualityLevel,
              name: istName,
            }
          : null,
      segmentTarget,
      feedbackGap: gaps.get(entry.relationshipId) ?? null,
      complete: shareTarget !== null && segmentTarget !== null,
    } satisfies SupplierMapRow;
  };
  const rows = top.map(rowOf);
  const rest = suppliers
    .filter((entry) => !topIds.has(entry.relationshipId))
    .map((entry) =>
      rowOf({
        ...entry,
        amountCents:
          spend.find((row) => row.relationshipId === entry.relationshipId)?.amountCents ?? 0,
      }),
    )
    .sort((a, b) => b.amountCents - a.amountCents);
  const restCents = rest.reduce((sum, row) => sum + row.amountCents, 0);
  return {
    spendYear,
    currency: spend[0]?.currency ?? 'EUR',
    totalCents: total,
    rows,
    rest,
    restCents,
    restShare: total > 0 ? restCents / total : 0,
    segmentTypes: types,
    complete: supplierMapComplete(rows),
    decisions,
  };
}
