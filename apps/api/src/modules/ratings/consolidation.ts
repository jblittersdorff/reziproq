import { and, asc, desc, eq, ne, schema, type TenantTransaction } from '@reziproq/db';
import type { DecisionVersion } from '@reziproq/shared';

/** Typname je Stufenpaar einer Modellversion der Organisation. */
export async function typeNames(tx: TenantTransaction, orgId: string, modelVersion: number) {
  const rows = await tx
    .select({
      impactLevel: schema.segmentType.impactLevel,
      qualityLevel: schema.segmentType.qualityLevel,
      name: schema.segmentType.name,
    })
    .from(schema.segmentType)
    .innerJoin(schema.segmentModel, eq(schema.segmentModel.id, schema.segmentType.modelId))
    .where(
      and(eq(schema.segmentModel.orgId, orgId), eq(schema.segmentModel.version, modelVersion)),
    );
  return new Map(rows.map((row) => [`${row.impactLevel}-${row.qualityLevel}`, row.name]));
}

/** Alle Konsolidierungen einer Beziehung, neueste Version zuerst; die Zeilen selbst bleiben unverändert. */
export async function readDecisions(
  tx: TenantTransaction,
  orgId: string,
  relationshipId: string,
): Promise<DecisionVersion[]> {
  const d = schema.segmentDecision;
  const rows = await tx
    .select({
      version: d.version,
      decidedAt: d.decidedAt,
      decidedById: d.decidedBy,
      decidedByName: schema.appUser.name,
      modelVersion: d.modelVersion,
      scope: d.scope,
      unitId: schema.businessUnit.id,
      unitName: schema.businessUnit.name,
      groupId: schema.materialGroup.id,
      groupName: schema.materialGroup.name,
      istImpact: d.istImpactLevel,
      istQuality: d.istQualityLevel,
      sollImpact: d.sollImpactLevel,
      sollQuality: d.sollQualityLevel,
      reason: d.reason,
    })
    .from(d)
    .innerJoin(schema.appUser, eq(schema.appUser.id, d.decidedBy))
    .leftJoin(schema.businessUnit, eq(schema.businessUnit.id, d.businessUnitId))
    .leftJoin(schema.materialGroup, eq(schema.materialGroup.id, d.materialGroupId))
    // WG-18: Segmente je Warengruppe haben eine eigene Versionsfolge und gehören nicht hierher.
    .where(and(eq(d.relationshipId, relationshipId), ne(d.scope, 'category')))
    .orderBy(desc(d.version), asc(d.scope), asc(schema.businessUnit.name));

  const names = new Map<number, Map<string, string>>();
  for (const version of new Set(rows.map((row) => row.modelVersion))) {
    names.set(version, await typeNames(tx, orgId, version));
  }
  const versions = new Map<number, DecisionVersion>();
  for (const row of rows) {
    const label = (impact: number, quality: number) =>
      names.get(row.modelVersion)?.get(`${impact}-${quality}`) ?? '';
    let entry = versions.get(row.version);
    if (!entry) {
      entry = {
        version: row.version,
        decidedAt: row.decidedAt.toISOString(),
        decidedBy: { userId: row.decidedById, name: row.decidedByName },
        modelVersion: row.modelVersion,
        entries: [],
      };
      versions.set(row.version, entry);
    }
    entry.entries.push({
      // Die Abfrage schließt `category` aus (WG-18).
      scope: row.scope as 'total' | 'bu_mg',
      businessUnit: row.unitId && row.unitName ? { id: row.unitId, name: row.unitName } : null,
      materialGroup: row.groupId && row.groupName ? { id: row.groupId, name: row.groupName } : null,
      ist: {
        impactLevel: row.istImpact,
        qualityLevel: row.istQuality,
        typeName: label(row.istImpact, row.istQuality),
      },
      soll: {
        impactLevel: row.sollImpact,
        qualityLevel: row.sollQuality,
        typeName: label(row.sollImpact, row.sollQuality),
      },
      reason: row.reason,
    });
  }
  return [...versions.values()];
}
