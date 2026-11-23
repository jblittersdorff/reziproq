import { and, desc, eq, inArray, schema, sql, type TenantTransaction } from '@reziproq/db';
import { type ConflictRule, lastFullYear } from '@reziproq/shared';
import { activeSegmentTypes, latestCategoryDecisions } from './supplier-map-data.js';

/**
 * WG-20: Was über einen Lieferanten je Warengruppe bekannt ist. Warengruppen sind die zugeordneten
 * und die mit Spend im letzten vollen Jahr. Je Warengruppe: Spend und Anteil, jüngste
 * Segmententscheidung (WG-18), jüngste Strategie und deren Supplier-Map-Zeile (WG-15).
 */
export async function supplierCategoryFacts(
  tx: TenantTransaction,
  orgId: string,
  relationshipId: string,
) {
  const spendYear = lastFullYear();
  const s = schema.relationshipSpend;
  const own = await tx
    .select({
      groupId: s.materialGroupId,
      amountCents: sql<number>`sum(${s.amountCents})::bigint`.mapWith(Number),
      currency: sql<string>`min(${s.currency})`,
    })
    .from(s)
    .where(
      and(
        eq(s.relationshipId, relationshipId),
        eq(s.kind, 'actual'),
        eq(s.year, spendYear),
        sql`${s.materialGroupId} is not null`,
      ),
    )
    .groupBy(s.materialGroupId);
  const assigned = await tx
    .select({ groupId: schema.relationshipMaterialGroup.materialGroupId })
    .from(schema.relationshipMaterialGroup)
    .where(eq(schema.relationshipMaterialGroup.relationshipId, relationshipId));
  const groupIds = [
    ...new Set([...own.map((row) => row.groupId as string), ...assigned.map((row) => row.groupId)]),
  ];
  if (groupIds.length === 0) {
    return { spendYear, currency: 'EUR', groups: [] as GroupFacts[] };
  }
  const groups = await tx
    .select({
      id: schema.materialGroup.id,
      name: schema.materialGroup.name,
      leadUserId: schema.materialGroup.leadUserId,
      leadName: schema.appUser.name,
      orgId: schema.materialGroup.orgId,
    })
    .from(schema.materialGroup)
    .leftJoin(schema.appUser, eq(schema.appUser.id, schema.materialGroup.leadUserId))
    .where(and(inArray(schema.materialGroup.id, groupIds), eq(schema.materialGroup.orgId, orgId)));
  const totals = await tx
    .select({
      groupId: s.materialGroupId,
      amountCents: sql<number>`sum(${s.amountCents})::bigint`.mapWith(Number),
    })
    .from(s)
    .where(and(inArray(s.materialGroupId, groupIds), eq(s.kind, 'actual'), eq(s.year, spendYear)))
    .groupBy(s.materialGroupId);
  const decisions = new Map<string, Awaited<ReturnType<typeof latestCategoryDecisions>>>();
  for (const id of groupIds) {
    decisions.set(id, await latestCategoryDecisions(tx, id, [relationshipId]));
  }
  const strategies = await tx
    .selectDistinctOn([schema.materialGroupStrategy.materialGroupId], {
      id: schema.materialGroupStrategy.id,
      groupId: schema.materialGroupStrategy.materialGroupId,
      year: schema.materialGroupStrategy.year,
      version: schema.materialGroupStrategy.version,
      status: schema.materialGroupStrategy.status,
    })
    .from(schema.materialGroupStrategy)
    .where(inArray(schema.materialGroupStrategy.materialGroupId, groupIds))
    .orderBy(
      schema.materialGroupStrategy.materialGroupId,
      desc(schema.materialGroupStrategy.year),
      desc(schema.materialGroupStrategy.version),
    );
  const strategyIds = strategies.map((row) => row.id);
  const mapRows = strategyIds.length
    ? await tx
        .select({
          strategyId: schema.materialGroupSupplierMapRow.strategyId,
          relationshipId: schema.materialGroupSupplierMapRow.relationshipId,
          shareTarget: schema.materialGroupSupplierMapRow.shareTarget,
          ended: schema.materialGroupSupplierMapRow.ended,
        })
        .from(schema.materialGroupSupplierMapRow)
        .where(inArray(schema.materialGroupSupplierMapRow.strategyId, strategyIds))
    : [];
  const awardLinks = strategyIds.length
    ? await tx
        .select({ strategyId: schema.materialGroupAwardSupplier.strategyId })
        .from(schema.materialGroupAwardSupplier)
        .where(
          and(
            inArray(schema.materialGroupAwardSupplier.strategyId, strategyIds),
            eq(schema.materialGroupAwardSupplier.relationshipId, relationshipId),
          ),
        )
    : [];
  const { types } = await activeSegmentTypes(tx, orgId);
  const nameOf = (impactLevel: number, qualityLevel: number) =>
    types.find((type) => type.impactLevel === impactLevel && type.qualityLevel === qualityLevel)
      ?.name ?? null;

  const result: GroupFacts[] = groups.map((group) => {
    const amountCents = own.find((row) => row.groupId === group.id)?.amountCents ?? 0;
    const total = totals.find((row) => row.groupId === group.id)?.amountCents ?? 0;
    const decision = decisions.get(group.id)?.get(relationshipId) ?? null;
    const strategy = strategies.find((row) => row.groupId === group.id) ?? null;
    const rowsOfStrategy = strategy ? mapRows.filter((row) => row.strategyId === strategy.id) : [];
    const map = rowsOfStrategy.find((row) => row.relationshipId === relationshipId) ?? null;
    const highestOther = Math.max(
      -1,
      ...rowsOfStrategy
        .filter((row) => row.relationshipId !== relationshipId)
        .map((row) => row.shareTarget ?? -1),
    );
    return {
      id: group.id,
      name: group.name,
      lead: group.leadUserId ? { userId: group.leadUserId, name: group.leadName ?? '' } : null,
      amountCents,
      share: total > 0 ? amountCents / total : 0,
      decision: decision
        ? {
            ist: {
              impactLevel: decision.istImpactLevel,
              qualityLevel: decision.istQualityLevel,
              name: nameOf(decision.istImpactLevel, decision.istQualityLevel),
            },
            soll: {
              impactLevel: decision.sollImpactLevel,
              qualityLevel: decision.sollQualityLevel,
              name: nameOf(decision.sollImpactLevel, decision.sollQualityLevel),
            },
          }
        : null,
      strategy,
      ended: map?.ended ?? false,
      shareTarget: map?.shareTarget ?? null,
      /** Größter Lieferant nach Soll-Anteil in der Supplier Map dieser Warengruppe */
      largestByTarget:
        map?.shareTarget !== null && map?.shareTarget !== undefined && map.shareTarget > 0
          ? map.shareTarget > highestOther
          : false,
      inAward: strategy ? awardLinks.some((link) => link.strategyId === strategy.id) : false,
    };
  });
  result.sort((a, b) => b.amountCents - a.amountCents || a.name.localeCompare(b.name));
  return { spendYear, currency: own[0]?.currency ?? 'EUR', groups: result };
}

export interface GroupFacts {
  id: string;
  name: string;
  lead: { userId: string; name: string } | null;
  amountCents: number;
  share: number;
  decision: {
    ist: { impactLevel: number; qualityLevel: number; name: string | null };
    soll: { impactLevel: number; qualityLevel: number; name: string | null };
  } | null;
  strategy: {
    id: string;
    groupId: string;
    year: number;
    version: number;
    status: 'draft' | 'resubmit' | 'approved';
  } | null;
  ended: boolean;
  shareTarget: number | null;
  largestByTarget: boolean;
  inAward: boolean;
}

export interface FoundConflict {
  rule: ConflictRule;
  groupIds: string[];
  fingerprint: string;
}

const ids = (groups: GroupFacts[]) => groups.map((group) => group.id).sort();

/**
 * Die vier Regeln aus WG-20. Je Regel höchstens ein Widerspruch je Lieferant; der Fingerabdruck
 * beschreibt die Lage (beteiligte Warengruppen je Rolle).
 */
export function findConflicts(groups: GroupFacts[]): FoundConflict[] {
  const found: FoundConflict[] = [];
  // Soll „beendet“ in einer und hoher Business Impact oder steigender Soll-Anteil in einer anderen
  const ended = groups.filter((group) => group.ended);
  const growing = groups.filter(
    (group) =>
      !group.ended &&
      ((group.decision?.soll.impactLevel ?? 0) === 3 ||
        (group.shareTarget !== null && group.shareTarget > Math.round(group.share * 100))),
  );
  if (ended.length > 0 && growing.length > 0) {
    found.push({
      rule: 'phase_out_vs_growth',
      groupIds: [...ids(ended), ...ids(growing)],
      fingerprint: `ended:${ids(ended).join(',')}|growth:${ids(growing).join(',')}`,
    });
  }
  // Beziehungsqualität im Segment schwach in einer und stark in einer anderen
  const weak = groups.filter((group) => group.decision?.ist.qualityLevel === 1);
  const strong = groups.filter((group) => group.decision?.ist.qualityLevel === 3);
  if (weak.length > 0 && strong.length > 0) {
    found.push({
      rule: 'relationship_mixed',
      groupIds: [...ids(weak), ...ids(strong)],
      fingerprint: `weak:${ids(weak).join(',')}|strong:${ids(strong).join(',')}`,
    });
  }
  // Nach Soll-Anteil in mehr als einer Warengruppe der größte
  const largest = groups.filter((group) => group.largestByTarget);
  if (largest.length > 1) {
    found.push({
      rule: 'concentration',
      groupIds: ids(largest),
      fingerprint: `largest:${ids(largest).join(',')}`,
    });
  }
  // Möglicher Lieferant einer Vergabe, obwohl sein Soll dort „beendet“ ist
  const awardEnded = groups.filter((group) => group.ended && group.inAward);
  if (awardEnded.length > 0) {
    found.push({
      rule: 'award_vs_target',
      groupIds: ids(awardEnded),
      fingerprint: `award:${ids(awardEnded).join(',')}`,
    });
  }
  return found;
}

/**
 * Gleicht die Widersprüche eines Lieferanten ab: Neue Lage legt einen offenen Widerspruch an (oder
 * aktualisiert den offenen derselben Regel). Abgestimmte oder hingenommene bleiben als Verlauf;
 * dieselbe Lage kommt nicht wieder. Offene ohne Lage entfallen.
 */
export async function syncConflicts(tx: TenantTransaction, orgId: string, relationshipId: string) {
  const { groups } = await supplierCategoryFacts(tx, orgId, relationshipId);
  const found = findConflicts(groups);
  const c = schema.materialGroupConflict;
  const existing = await tx.select().from(c).where(eq(c.relationshipId, relationshipId));
  for (const conflict of found) {
    if (
      existing.some(
        (row) => row.ruleKey === conflict.rule && row.fingerprint === conflict.fingerprint,
      )
    ) {
      continue;
    }
    const open = existing.find((row) => row.ruleKey === conflict.rule && row.status === 'open');
    if (open) {
      await tx
        .update(c)
        .set({ fingerprint: conflict.fingerprint, materialGroupIds: conflict.groupIds })
        .where(eq(c.id, open.id));
    } else {
      await tx.insert(c).values({
        orgId,
        relationshipId,
        ruleKey: conflict.rule,
        fingerprint: conflict.fingerprint,
        materialGroupIds: conflict.groupIds,
      });
    }
  }
  // Offen und ohne Lage dieser Regel: entfällt (die Regel trifft nicht mehr zu)
  const stale = existing.filter(
    (row) => row.status === 'open' && !found.some((conflict) => conflict.rule === row.ruleKey),
  );
  if (stale.length) {
    await tx.delete(c).where(
      inArray(
        c.id,
        stale.map((row) => row.id),
      ),
    );
  }
  return found;
}

/** Alle Lieferanten der Organisation mit Warengruppen abgleichen (täglicher Job). */
export async function syncAllConflicts(tx: TenantTransaction, orgId: string) {
  const rows = await tx.execute<{ id: string }>(sql`
    select r.id from relationship r
    where r.buyer_org_id = ${orgId} and r.status <> 'ended'
      and (select count(distinct g) from (
        select material_group_id as g from relationship_material_group where relationship_id = r.id
        union select material_group_id from relationship_spend
          where relationship_id = r.id and material_group_id is not null
      ) x) >= 1`);
  for (const row of rows.rows) await syncConflicts(tx, orgId, row.id);
  return rows.rows.length;
}
