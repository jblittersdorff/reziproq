import { appliesTo } from '@reziproq/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from './client.js';
import {
  cycle,
  formatCatalogItem,
  relationshipSide,
  relationshipTarget,
  ruleCatalogItem,
  ruleSet,
  ruleSetItem,
  segmentDecision,
  segmentModel,
  segmentType,
} from './schema/index.js';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface SeedRuleSet {
  relationshipId: string;
  ist: [number, number];
  soll: [number, number];
  status: 'draft' | 'approved' | 'shared';
  focusReason: string;
}

/**
 * Beispieldaten für M14 (PLB-03, SEG-10): Konsolidierung, Fokus und Spielregeln aus dem Katalog
 * für einige Beziehungen eines Käufers. Wiederholbar: Was es schon gibt, bleibt.
 */
export async function seedRuleSets(
  tx: Transaction,
  buyerOrgId: string,
  userId: string,
  userName: string,
  entries: SeedRuleSet[],
  now: Date,
) {
  const [model] = await tx
    .select({ id: segmentModel.id, version: segmentModel.version })
    .from(segmentModel)
    .where(and(eq(segmentModel.orgId, buyerOrgId), eq(segmentModel.status, 'active')));
  if (!model) return;
  const rules = await tx
    .select()
    .from(ruleCatalogItem)
    .where(eq(ruleCatalogItem.orgId, buyerOrgId));
  const formats = await tx
    .select()
    .from(formatCatalogItem)
    .where(eq(formatCatalogItem.orgId, buyerOrgId));

  for (const entry of entries) {
    const [impact, quality] = entry.soll;
    const [decided] = await tx
      .select({ id: segmentDecision.id })
      .from(segmentDecision)
      .where(eq(segmentDecision.relationshipId, entry.relationshipId))
      .limit(1);
    if (!decided) {
      await tx.insert(segmentDecision).values({
        relationshipId: entry.relationshipId,
        scope: 'total',
        istImpactLevel: entry.ist[0],
        istQualityLevel: entry.ist[1],
        sollImpactLevel: impact,
        sollQualityLevel: quality,
        reason: 'Beispiel aus den Demodaten',
        modelVersion: model.version,
        decidedBy: userId,
        version: 1,
      });
    }
    await tx
      .insert(relationshipSide)
      .values({
        relationshipId: entry.relationshipId,
        orgId: buyerOrgId,
        isFocus: true,
        focusReason: entry.focusReason,
        focusSetBy: userId,
        focusSetAt: now,
      })
      .onConflictDoUpdate({
        target: [relationshipSide.relationshipId, relationshipSide.orgId],
        set: {
          isFocus: true,
          focusReason: sql`excluded.focus_reason`,
          focusSetBy: sql`excluded.focus_set_by`,
          focusSetAt: sql`excluded.focus_set_at`,
        },
      });

    // ZYK-01: Mit dem Fokus startet der Jahreszyklus; der JBP-Termin liegt acht Wochen voraus.
    const jbpDate = new Date(now.getTime() + 56 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await tx
      .insert(cycle)
      .values({
        relationshipId: entry.relationshipId,
        label: String(now.getUTCFullYear()),
        startedAt: now,
        jbpDate,
        status: 'active',
      })
      .onConflictDoNothing();

    const [existing] = await tx
      .select({ id: ruleSet.id })
      .from(ruleSet)
      .where(eq(ruleSet.relationshipId, entry.relationshipId))
      .limit(1);
    if (existing) continue;
    const [type] = await tx
      .select({ name: segmentType.name, description: segmentType.description })
      .from(segmentType)
      .where(
        and(
          eq(segmentType.modelId, model.id),
          eq(segmentType.impactLevel, impact),
          eq(segmentType.qualityLevel, quality),
        ),
      );
    const typeName = type?.name ?? `${impact}-${quality}`;
    const visibility = entry.status === 'shared' ? ('shared' as const) : ('internal' as const);
    const approved = entry.status !== 'draft';
    const [set] = await tx
      .insert(ruleSet)
      .values({
        relationshipId: entry.relationshipId,
        ownerOrgId: buyerOrgId,
        visibility,
        version: 1,
        status: entry.status,
        targetImpactLevel: impact,
        targetQualityLevel: quality,
        typeName,
        createdBy: userId,
        approvedBy: approved ? userId : null,
        approvedByName: approved ? userName : null,
        approvedAt: approved ? now : null,
      })
      .returning({ id: ruleSet.id });
    if (!set) continue;
    const fits = (item: { minImpactLevel: number; forQualityLevels?: number[] }) =>
      appliesTo(item, impact, quality);
    let position = 0;
    const base = {
      ruleSetId: set.id,
      relationshipId: entry.relationshipId,
      ownerOrgId: buyerOrgId,
      visibility,
      origin: 'catalog' as const,
    };
    const items = [
      ...rules.filter(fits).map((rule) => ({
        ...base,
        kind: rule.kind,
        group: rule.group,
        title: rule.title,
        description: rule.description,
        cadence: null,
        level: null,
        catalogItemId: rule.id,
        position: ++position,
      })),
      ...formats.filter(fits).map((format) => ({
        ...base,
        kind: 'format' as const,
        group: null,
        title: format.name,
        description: format.purpose,
        cadence: format.cadence,
        level: format.level,
        catalogItemId: format.id,
        position: ++position,
      })),
    ];
    if (items.length > 0) await tx.insert(ruleSetItem).values(items);
    if (entry.status === 'shared') {
      await tx.insert(relationshipTarget).values({
        relationshipId: entry.relationshipId,
        ownerOrgId: buyerOrgId,
        visibility: 'shared',
        typeName,
        typeDescription: type?.description ?? '',
        ruleSetId: set.id,
        ruleSetVersion: 1,
        sharedAt: now,
        sharedBy: userId,
        sharedByName: userName,
      });
    }
  }
}
