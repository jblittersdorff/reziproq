import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  currentTime,
  desc,
  eq,
  inArray,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  calculateSegment,
  type DueItem,
  resolveConflictSchema,
  type SegmentProposal,
  type SupplierCategories,
  supplierCategoriesSchema,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { readDecisions } from '../ratings/consolidation.js';
import { RatingsService } from '../ratings/ratings.service.js';
import { averaged } from '../ratings/segmentation.js';
import { ownRelationship, sroOf } from '../suppliers/team.service.js';
import { type GroupFacts, supplierCategoryFacts, syncAllConflicts } from './merge-facts.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

const supplierName = sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`;

/**
 * WG-20 (Schritt 31): Zusammenführung je Lieferant. Käufer mit Zugriff lesen; Widersprüche lösen
 * SRO der Beziehung sowie Lead und Commodity Manager der betroffenen Warengruppen (Gründer,
 * 23.11.2026). Den Vorschlag für das Gesamtsegment übernehmen SRO oder Admin, wie die
 * Konsolidierung in SEG. Der Lieferant sieht nichts davon (org_private, nur Käufer).
 */
@Injectable()
export class MergeService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(RatingsService) private readonly ratings: RatingsService,
  ) {}

  private run<T>(
    auth: AuthContext,
    work: (tx: TenantTransaction, organization: AccountOrganization) => Promise<T>,
  ): Promise<T> {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, (tx) =>
      work(tx, organization),
    );
  }

  /** Warengruppen, in denen die Person Lead oder Commodity Manager ist */
  private async managedGroups(tx: TenantTransaction, auth: AuthContext, groupIds: string[]) {
    if (groupIds.length === 0) return new Set<string>();
    const direct = await tx
      .select({ id: schema.materialGroup.id })
      .from(schema.materialGroup)
      .where(
        and(
          inArray(schema.materialGroup.id, groupIds),
          sql`(${schema.materialGroup.leadUserId} = ${auth.userId} or ${schema.materialGroup.commodityManagerUserId} = ${auth.userId})`,
        ),
      );
    const members = await tx
      .select({ id: schema.materialGroupMember.materialGroupId })
      .from(schema.materialGroupMember)
      .where(
        and(
          inArray(schema.materialGroupMember.materialGroupId, groupIds),
          eq(schema.materialGroupMember.userId, auth.userId),
          inArray(schema.materialGroupMember.role, ['lead', 'commodity_manager']),
        ),
      );
    return new Set([...direct, ...members].map((row) => row.id));
  }

  view(auth: AuthContext, relationshipId: string): Promise<SupplierCategories> {
    return this.run(auth, (tx, organization) =>
      this.viewIn(tx, auth, organization, relationshipId),
    );
  }

  private async viewIn(
    tx: TenantTransaction,
    auth: AuthContext,
    organization: AccountOrganization,
    relationshipId: string,
  ): Promise<SupplierCategories> {
    await ownRelationship(tx, organization, relationshipId);
    const [name] = await tx
      .select({ name: supplierName })
      .from(schema.relationship)
      .innerJoin(schema.organization, eq(schema.organization.id, schema.relationship.supplierOrgId))
      .leftJoin(
        schema.relationshipSide,
        and(
          eq(schema.relationshipSide.relationshipId, schema.relationship.id),
          eq(schema.relationshipSide.orgId, organization.id),
        ),
      )
      .where(eq(schema.relationship.id, relationshipId));
    const facts = await supplierCategoryFacts(tx, organization.id, relationshipId);
    const sro = await sroOf(tx, organization, relationshipId);
    const isSro = sro?.userId === auth.userId;
    const managed = await this.managedGroups(
      tx,
      auth,
      facts.groups.map((group) => group.id),
    );
    const conflicts = await tx
      .select({ conflict: schema.materialGroupConflict, decidedByName: schema.appUser.name })
      .from(schema.materialGroupConflict)
      .leftJoin(schema.appUser, eq(schema.appUser.id, schema.materialGroupConflict.decidedBy))
      .where(eq(schema.materialGroupConflict.relationshipId, relationshipId))
      .orderBy(
        sql`case when ${schema.materialGroupConflict.status} = 'open' then 0 else 1 end`,
        desc(schema.materialGroupConflict.createdAt),
      );
    const groupName = (id: string) => facts.groups.find((group) => group.id === id)?.name ?? '';
    const decisions = await readDecisions(tx, organization.id, relationshipId);
    const total = decisions[0]?.entries.find((entry) => entry.scope === 'total');
    const [origin] = total
      ? await tx
          .select({ origin: schema.segmentDecision.origin })
          .from(schema.segmentDecision)
          .where(
            and(
              eq(schema.segmentDecision.relationshipId, relationshipId),
              eq(schema.segmentDecision.scope, 'total'),
            ),
          )
          .orderBy(desc(schema.segmentDecision.version))
          .limit(1)
      : [];
    const totalCents = facts.groups.reduce((sum, group) => sum + group.amountCents, 0);
    return supplierCategoriesSchema.parse({
      relationshipId,
      supplierName: name?.name ?? '',
      spendYear: facts.spendYear,
      currency: facts.currency,
      totalCents,
      rows: facts.groups.map((group) => ({
        groupId: group.id,
        groupName: group.name,
        lead: group.lead,
        amountCents: group.amountCents,
        shareInGroup: Math.min(1, group.share),
        segmentIst:
          group.decision && group.decision.ist.name !== null
            ? { ...group.decision.ist, name: group.decision.ist.name }
            : null,
        sollType: group.ended
          ? { kind: 'ended' }
          : group.decision && group.decision.soll.name !== null
            ? { kind: 'segment', ...group.decision.soll, name: group.decision.soll.name }
            : null,
        qualityLevel: group.decision?.ist.qualityLevel ?? null,
        strategy: group.strategy
          ? {
              id: group.strategy.id,
              year: group.strategy.year,
              version: group.strategy.version,
              status: group.strategy.status,
            }
          : null,
      })),
      conflicts: conflicts.map(({ conflict, decidedByName }) => ({
        id: conflict.id,
        ruleKey: conflict.ruleKey,
        groups: conflict.materialGroupIds.map((id) => ({ id, name: groupName(id) })),
        status: conflict.status,
        note: conflict.note,
        decidedBy: decidedByName,
        decidedAt: conflict.decidedAt?.toISOString() ?? null,
        createdAt: conflict.createdAt.toISOString(),
        canResolve:
          conflict.status === 'open' &&
          (isSro || conflict.materialGroupIds.some((id) => managed.has(id))),
      })),
      proposal: await this.proposal(tx, auth, organization.id, relationshipId, facts.groups),
      decided: total
        ? { ist: total.ist.typeName, soll: total.soll.typeName, origin: origin?.origin ?? 'round' }
        : null,
      canAdopt: isSro || auth.orgRole === 'admin',
    });
  }

  /**
   * Vorschlag für das Gesamtsegment (WG-20): je Kriterium der mit dem Spend der Warengruppe
   * gewichtete Mittelwert der Bewertungen aus den Warengruppen, daraus das Segment nach der Matrix.
   * Warengruppen ohne Bewertung oder ohne Spend zählen nicht; die übrigen werden normiert.
   */
  private async proposal(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
    relationshipId: string,
    groups: GroupFacts[],
  ): Promise<SegmentProposal | null> {
    const rated: {
      group: GroupFacts;
      model: NonNullable<
        Awaited<ReturnType<RatingsService['segmentationIn']>>['segmentation']
      >['model'];
      values: ReturnType<typeof averaged>;
    }[] = [];
    const skipped: SegmentProposal['skipped'] = [];
    for (const group of groups) {
      const { segmentation } = await this.ratings.segmentationIn(
        tx,
        auth,
        orgId,
        relationshipId,
        group.id,
      );
      const values = segmentation
        ? averaged(
            segmentation.rows.map((row) => ({
              id: row.assignmentId,
              businessUnit: row.businessUnit,
              materialGroup: row.materialGroup,
              function: row.function,
              values: row.values,
            })),
            segmentation.model.criteria,
          )
        : null;
      if (!segmentation || !values || values.some((value) => value.ist === null)) {
        skipped.push({ groupId: group.id, groupName: group.name, reason: 'no_rating' });
      } else if (group.amountCents <= 0) {
        skipped.push({ groupId: group.id, groupName: group.name, reason: 'no_spend' });
      } else {
        rated.push({ group, model: segmentation.model, values });
      }
    }
    if (groups.length === 0) return null;
    const newest = rated.reduce<(typeof rated)[number] | null>(
      (best, entry) => (!best || entry.model.version > best.model.version ? entry : best),
      null,
    );
    if (!newest) return { ist: null, soll: null, criteria: [], sources: [], skipped };
    // Nur Bewertungen nach demselben Modell lassen sich mitteln
    const sameModel = rated.filter((entry) => entry.model.version === newest.model.version);
    for (const entry of rated.filter((item) => !sameModel.includes(item))) {
      skipped.push({ groupId: entry.group.id, groupName: entry.group.name, reason: 'no_rating' });
    }
    const weightTotal = sameModel.reduce((sum, entry) => sum + entry.group.amountCents, 0);
    const weighted = (key: string, field: 'ist' | 'soll') => {
      let sum = 0;
      for (const entry of sameModel) {
        const value = entry.values.find((item) => item.criterionKey === key)?.[field];
        if (value === null || value === undefined) return null;
        sum += value * (entry.group.amountCents / weightTotal);
      }
      return Math.round(sum * 100) / 100;
    };
    const model = newest.model;
    const criteria = model.criteria.map((criterion) => ({
      criterionKey: criterion.key,
      label: criterion.name,
      ist: weighted(criterion.key, 'ist'),
      soll: weighted(criterion.key, 'soll'),
    }));
    const outcome = (field: 'ist' | 'soll') => {
      if (criteria.some((entry) => entry[field] === null)) return null;
      const result = calculateSegment(
        model,
        Object.fromEntries(criteria.map((entry) => [entry.criterionKey, entry[field] as number])),
      );
      return {
        impactScore: Math.round(result.impactScore * 100) / 100,
        qualityScore: Math.round(result.qualityScore * 100) / 100,
        impactLevel: result.impactLevel,
        qualityLevel: result.qualityLevel,
        typeName: result.type.name,
      };
    };
    return {
      ist: outcome('ist'),
      soll: outcome('soll'),
      criteria,
      sources: sameModel.map((entry) => ({
        groupId: entry.group.id,
        groupName: entry.group.name,
        amountCents: entry.group.amountCents,
        weight: Math.round((entry.group.amountCents / weightTotal) * 10_000) / 10_000,
      })),
      skipped,
    };
  }

  /** Widerspruch lösen: abgestimmt (Notiz) oder hingenommen (Begründung) */
  resolve(auth: AuthContext, conflictId: string, input: unknown): Promise<SupplierCategories> {
    return this.run(auth, async (tx, organization) => {
      const parsed = resolveConflictSchema.safeParse(input);
      if (!parsed.success) {
        throw new BadRequestException({ statusCode: 400, code: 'note_required' });
      }
      const [conflict] = await tx
        .select()
        .from(schema.materialGroupConflict)
        .where(eq(schema.materialGroupConflict.id, conflictId));
      if (!conflict) throw notFound();
      if (conflict.status !== 'open') {
        throw new ConflictException({ statusCode: 409, code: 'conflict_decided' });
      }
      const sro = await sroOf(tx, organization, conflict.relationshipId);
      const managed = await this.managedGroups(tx, auth, conflict.materialGroupIds);
      if (sro?.userId !== auth.userId && managed.size === 0) throw forbidden();
      await tx
        .update(schema.materialGroupConflict)
        .set({
          status: parsed.data.status,
          note: parsed.data.note,
          decidedBy: auth.userId,
          decidedAt: currentTime(),
        })
        .where(eq(schema.materialGroupConflict.id, conflict.id));
      return this.viewIn(tx, auth, organization, conflict.relationshipId);
    });
  }

  /** Vorschlag übernehmen: Gesamtsegment in SEG mit Herkunft „merged“ (SRO oder Admin) */
  adopt(auth: AuthContext, relationshipId: string): Promise<SupplierCategories> {
    return this.run(auth, async (tx, organization) => {
      await ownRelationship(tx, organization, relationshipId);
      const sro = await sroOf(tx, organization, relationshipId);
      if (auth.orgRole !== 'admin' && sro?.userId !== auth.userId) throw forbidden();
      const facts = await supplierCategoryFacts(tx, organization.id, relationshipId);
      const proposal = await this.proposal(tx, auth, organization.id, relationshipId, facts.groups);
      if (!proposal?.ist || !proposal.soll) {
        throw new ConflictException({ statusCode: 409, code: 'no_proposal' });
      }
      const [model] = await tx
        .select({ version: schema.segmentModel.version })
        .from(schema.segmentModel)
        .where(
          and(
            eq(schema.segmentModel.orgId, organization.id),
            eq(schema.segmentModel.status, 'active'),
          ),
        );
      const [latest] = await tx
        .select({ version: sql<number>`coalesce(max(${schema.segmentDecision.version}), 0)::int` })
        .from(schema.segmentDecision)
        .where(
          sql`${schema.segmentDecision.relationshipId} = ${relationshipId} and ${schema.segmentDecision.scope} <> 'category'`,
        );
      await tx.insert(schema.segmentDecision).values({
        relationshipId,
        scope: 'total',
        istImpactLevel: proposal.ist.impactLevel,
        istQualityLevel: proposal.ist.qualityLevel,
        sollImpactLevel: proposal.soll.impactLevel,
        sollQualityLevel: proposal.soll.qualityLevel,
        reason: 'Vorschlag aus der Zusammenführung der Warengruppen übernommen',
        modelVersion: model?.version ?? 1,
        decidedBy: auth.userId,
        version: (latest?.version ?? 0) + 1,
        origin: 'merged',
      });
      return this.viewIn(tx, auth, organization, relationshipId);
    });
  }

  /** Täglicher Job: Widersprüche aller Lieferanten einer Organisation abgleichen */
  syncOrganization(orgId: string) {
    return this.tenant.run({ userId: 'system:widersprueche', organizationId: orgId }, (tx) =>
      syncAllConflicts(tx, orgId),
    );
  }
}

/**
 * Aufgaben aus WG-20 für Mein Tag: „Botschaft abstimmen“ beim SRO und bei den Leads der betroffenen
 * Warengruppen; „Gesamtsegment prüfen“ beim SRO, wenn eine Warengruppe neuer entschieden ist.
 */
export async function mergeDueItems(tx: TenantTransaction, auth: AuthContext): Promise<DueItem[]> {
  const conflicts = await tx.execute<{
    id: string;
    relationship_id: string;
    supplier: string;
    rule_key: string;
    created_at: string;
  }>(sql`
    select c.id, c.relationship_id, coalesce(rs.display_name, o.name) as supplier, c.rule_key,
      (c.created_at::date + 14)::text as created_at
    from material_group_conflict c
    join relationship r on r.id = c.relationship_id
    join organization o on o.id = r.supplier_org_id
    left join relationship_side rs on rs.relationship_id = r.id and rs.org_id = r.buyer_org_id
    where c.status = 'open' and (
      exists (select 1 from relationship_member m where m.relationship_id = c.relationship_id
        and m.user_id = ${auth.userId} and m.team_role = 'sro')
      or exists (select 1 from material_group g where g.id = any(c.material_group_ids)
        and g.lead_user_id = ${auth.userId})
      or exists (select 1 from material_group_member gm where gm.material_group_id = any(c.material_group_ids)
        and gm.user_id = ${auth.userId} and gm.role = 'lead'))
    order by c.created_at`);
  const checks = await tx.execute<{
    relationship_id: string;
    supplier: string;
    decided: string;
  }>(sql`
    select r.id as relationship_id, coalesce(rs.display_name, o.name) as supplier,
      max(d.decided_at)::date::text as decided
    from relationship r
    join organization o on o.id = r.supplier_org_id
    left join relationship_side rs on rs.relationship_id = r.id and rs.org_id = r.buyer_org_id
    join relationship_member m on m.relationship_id = r.id and m.user_id = ${auth.userId} and m.team_role = 'sro'
    join segment_decision d on d.relationship_id = r.id and d.scope = 'category'
    where exists (select 1 from segment_decision t where t.relationship_id = r.id and t.scope = 'total')
    group by r.id, rs.display_name, o.name
    having max(d.decided_at) > (select max(t.decided_at) from segment_decision t
      where t.relationship_id = r.id and t.scope = 'total')`);
  return [
    ...conflicts.rows.map((row) => ({
      id: `conflict:${row.id}`,
      kind: 'category_conflict' as const,
      supplier: row.supplier,
      detail: row.rule_key,
      dueDate: row.created_at,
      href: `/lieferanten/${row.relationship_id}/strategie/warengruppen`,
    })),
    ...checks.rows.map((row) => ({
      id: `segment-check:${row.relationship_id}`,
      kind: 'overall_segment_check' as const,
      supplier: row.supplier,
      detail: row.decided,
      dueDate: row.decided,
      href: `/lieferanten/${row.relationship_id}/strategie/warengruppen`,
    })),
  ];
}
