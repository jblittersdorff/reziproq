import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, auditedChange, eq, schema, type TenantTransaction } from '@reziproq/db';
import {
  defaultObjectiveCategories,
  objectiveCategoriesResponseSchema,
  type ObjectiveCategoryRequest,
  type PlanObjectiveRequest,
  type SupplierPlanResponse,
  supplierPlanResponseSchema,
  type UpdateObjectiveCategory,
  type UpdatePlanSummary,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import {
  objectiveCategoryAudit,
  planObjectiveAudit,
  supplierPlanAudit,
} from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { readDecisions } from '../ratings/consolidation.js';
import { readContributions, summarizeContributions } from './contributions.js';
import { readTopics } from './strategic-topics.js';
import { ownRelationship, sroOf } from '../suppliers/team.service.js';

const notFound = () =>
  new NotFoundException({ statusCode: 404, code: 'nicht_gefunden', message: 'Nicht gefunden.' });

const conflict = (code: string, message: string) =>
  new ConflictException({ statusCode: 409, code, message });

@Injectable()
export class SupplierPlansService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  organization(auth: AuthContext): AccountOrganization {
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'lieferanten.sehen')) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    return organization;
  }

  async ensureDefaultCategories(tx: TenantTransaction, organizationId: string) {
    await tx
      .insert(schema.objectiveCategory)
      .values(
        defaultObjectiveCategories.map((category, index) => ({
          orgId: organizationId,
          ...category,
          position: index + 1,
        })),
      )
      .onConflictDoNothing();
    return tx
      .select()
      .from(schema.objectiveCategory)
      .where(eq(schema.objectiveCategory.orgId, organizationId))
      .orderBy(asc(schema.objectiveCategory.position), asc(schema.objectiveCategory.key));
  }

  async listCategories(auth: AuthContext) {
    const organization = this.organization(auth);
    return this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => {
        const categories = await this.ensureDefaultCategories(tx, organization.id);
        return objectiveCategoriesResponseSchema.parse({ categories });
      },
    );
  }

  async createCategory(auth: AuthContext, input: ObjectiveCategoryRequest) {
    const organization = this.categoryEditor(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await this.ensureDefaultCategories(tx, organization.id);
      const actor = await actorOf(tx, auth, organization.id);
      const category = await auditedChange(tx, actor, objectiveCategoryAudit, async () => {
        const [created] = await tx
          .insert(schema.objectiveCategory)
          .values({
            orgId: organization.id,
            key: input.key,
            name: input.name,
            position: input.position,
          })
          .onConflictDoNothing()
          .returning();
        if (!created) throw conflict('category_taken', 'Dieser Kategorien-Schlüssel existiert bereits.');
        return {
          objectId: `${organization.id}:${created.key}`,
          relationshipId: null,
          action: 'created',
          after: { name: created.name, position: created.position, active: created.active },
          result: created,
        };
      });
      return category;
    });
  }

  async updateCategory(auth: AuthContext, key: string, input: UpdateObjectiveCategory) {
    const organization = this.categoryEditor(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const [before] = await tx
        .select()
        .from(schema.objectiveCategory)
        .where(
          and(
            eq(schema.objectiveCategory.orgId, organization.id),
            eq(schema.objectiveCategory.key, key),
          ),
        );
      if (!before) throw notFound();
      const actor = await actorOf(tx, auth, organization.id);
      return auditedChange(tx, actor, objectiveCategoryAudit, async () => {
        const [updated] = await tx
          .update(schema.objectiveCategory)
          .set({ name: input.name, position: input.position, active: input.active })
          .where(
            and(
              eq(schema.objectiveCategory.orgId, organization.id),
              eq(schema.objectiveCategory.key, key),
            ),
          )
          .returning();
        if (!updated) throw notFound();
        return {
          objectId: `${organization.id}:${key}`,
          relationshipId: null,
          action: 'updated',
          before: { name: before.name, position: before.position, active: before.active },
          after: { name: updated.name, position: updated.position, active: updated.active },
          result: updated,
        };
      });
    });
  }

  async get(auth: AuthContext, relationshipId: string): Promise<SupplierPlanResponse> {
    const organization = this.organization(auth);
    return this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => {
        await ownRelationship(tx, organization, relationshipId);
        const categories = await this.ensureDefaultCategories(tx, organization.id);
        const [cycle] = await tx
          .select()
          .from(schema.cycle)
          .where(
            and(
              eq(schema.cycle.relationshipId, relationshipId),
              eq(schema.cycle.status, 'active'),
            ),
          )
          .limit(1);
        const [permissions, sro] = await Promise.all([
          this.relationshipPermissions(tx, auth, organization.id, relationshipId),
          sroOf(tx, organization, relationshipId),
        ]);
        if (!cycle) {
          return supplierPlanResponseSchema.parse({
            plan: null,
            cycleId: null,
            categories,
            teamCandidates: [],
            canCreate: false,
          });
        }
        const [plan] = await tx
          .select()
          .from(schema.supplierPlan)
          .where(eq(schema.supplierPlan.cycleId, cycle.id))
          .limit(1);
        const categoryByKey = new Map(categories.map((category) => [category.key, category]));
        const teamCandidates = await this.teamCandidatesIn(tx, organization.id, relationshipId);
        if (!plan) {
          return supplierPlanResponseSchema.parse({
            plan: null,
            cycleId: cycle.id,
            categories: categories.filter((category) => category.active),
            teamCandidates,
            canCreate: permissions.canManage,
          });
        }

        const objectives = await tx
          .select({
            id: schema.planObjective.id,
            categoryKey: schema.planObjective.categoryKey,
            businessUnitId: schema.businessUnit.id,
            businessUnitName: schema.businessUnit.name,
            materialGroupId: schema.materialGroup.id,
            materialGroupName: schema.materialGroup.name,
            text: schema.planObjective.text,
            ownerUserId: schema.planObjective.ownerUserId,
            ownerName: schema.appUser.name,
            targetYear: schema.planObjective.targetYear,
          })
          .from(schema.planObjective)
          .innerJoin(
            schema.appUser,
            eq(schema.appUser.id, schema.planObjective.ownerUserId),
          )
          .leftJoin(
            schema.businessUnit,
            eq(schema.businessUnit.id, schema.planObjective.businessUnitId),
          )
          .leftJoin(
            schema.materialGroup,
            eq(schema.materialGroup.id, schema.planObjective.materialGroupId),
          )
          .where(
            and(
              eq(schema.planObjective.planId, plan.id),
              eq(schema.planObjective.relationshipId, relationshipId),
            ),
          )
          .orderBy(asc(schema.planObjective.targetYear), asc(schema.planObjective.text));
        const contributions = await readContributions(tx, relationshipId, plan.id);
        const topics = await readTopics(tx, relationshipId, plan.id);
        const decisions = await readDecisions(tx, organization.id, relationshipId);
        const targetType =
          decisions[0]?.entries.find((entry) => entry.scope === 'total')?.soll.typeName ?? null;

        return supplierPlanResponseSchema.parse({
          plan: {
            id: plan.id,
            relationshipId,
            cycleId: cycle.id,
            version: plan.version,
            status: plan.status,
            summary: plan.summary,
            createdAt: plan.createdAt.toISOString(),
            targetType,
            sro,
            canManage: permissions.canManage && plan.status === 'draft',
            contributions: summarizeContributions(contributions),
            topics,
            objectives: objectives.map((objective) => ({
              id: objective.id,
              categoryKey: objective.categoryKey,
              categoryName:
                categoryByKey.get(objective.categoryKey)?.name ?? objective.categoryKey,
              businessUnit:
                objective.businessUnitId && objective.businessUnitName
                  ? { id: objective.businessUnitId, name: objective.businessUnitName }
                  : null,
              materialGroup:
                objective.materialGroupId && objective.materialGroupName
                  ? { id: objective.materialGroupId, name: objective.materialGroupName }
                  : null,
              text: objective.text,
              owner: { userId: objective.ownerUserId, name: objective.ownerName },
              targetYear: objective.targetYear,
              canEdit:
                plan.status === 'draft' &&
                (permissions.canManage ||
                  (permissions.isTeamMember && objective.ownerUserId === auth.userId)),
            })),
          },
          cycleId: cycle.id,
          categories: categories.filter(
            (category) =>
              category.active ||
              objectives.some((objective) => objective.categoryKey === category.key),
          ),
          teamCandidates,
          canCreate: false,
        });
      },
    );
  }

  async create(auth: AuthContext, relationshipId: string) {
    const organization = this.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      const permissions = await this.relationshipPermissions(
        tx,
        auth,
        organization.id,
        relationshipId,
      );
      if (!permissions.canManage) {
        throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
      }
      const [cycle] = await tx
        .select()
        .from(schema.cycle)
        .where(
          and(
            eq(schema.cycle.relationshipId, relationshipId),
            eq(schema.cycle.status, 'active'),
          ),
        )
        .limit(1);
      if (!cycle) throw conflict('zyklus_nicht_aktiv', 'Es gibt keinen aktiven Zyklus.');

      const actor = await actorOf(tx, auth, organization.id);
      const id = await auditedChange(tx, actor, supplierPlanAudit, async () => {
        const [created] = await tx
          .insert(schema.supplierPlan)
          .values({ relationshipId, cycleId: cycle.id })
          .onConflictDoNothing()
          .returning({ id: schema.supplierPlan.id });
        if (!created) throw conflict('plan_exists', 'Für diesen Zyklus gibt es bereits einen Entwurf.');
        return {
          objectId: created.id,
          relationshipId,
          action: 'created',
          after: { version: 1, status: 'draft', summary: '' },
          result: created.id,
        };
      });
      return { id };
    });
  }

  async updateSummary(
    auth: AuthContext,
    relationshipId: string,
    planId: string,
    input: UpdatePlanSummary,
  ) {
    const organization = this.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      const plan = await this.draftPlan(tx, relationshipId, planId);
      await this.requirePlanManager(tx, auth, organization.id, relationshipId);
      const actor = await actorOf(tx, auth, organization.id);
      return auditedChange(tx, actor, supplierPlanAudit, async () => {
        const [updated] = await tx
          .update(schema.supplierPlan)
          .set({ summary: input.summary })
          .where(eq(schema.supplierPlan.id, plan.id))
          .returning({ summary: schema.supplierPlan.summary });
        if (!updated) throw notFound();
        return {
          objectId: plan.id,
          relationshipId,
          action: 'updated',
          before: { summary: plan.summary },
          after: { summary: updated.summary },
          result: updated,
        };
      });
    });
  }

  async createObjective(
    auth: AuthContext,
    relationshipId: string,
    planId: string,
    input: PlanObjectiveRequest,
  ) {
    const organization = this.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      await this.draftPlan(tx, relationshipId, planId);
      await this.requirePlanManager(tx, auth, organization.id, relationshipId);
      await this.validateObjective(tx, organization.id, relationshipId, input);
      const actor = await actorOf(tx, auth, organization.id);
      const id = await auditedChange(tx, actor, planObjectiveAudit, async () => {
        const [created] = await tx
          .insert(schema.planObjective)
          .values({
            relationshipId,
            planId,
            categoryKey: input.categoryKey,
            businessUnitId: input.businessUnitId,
            materialGroupId: input.materialGroupId,
            text: input.text,
            ownerUserId: input.ownerUserId,
            targetYear: input.targetYear,
          })
          .returning({ id: schema.planObjective.id });
        if (!created) throw new Error('Ziel konnte nicht angelegt werden');
        return {
          objectId: created.id,
          relationshipId,
          action: 'created',
          after: objectiveAuditValue(input),
          result: created.id,
        };
      });
      return { id };
    });
  }

  async updateObjective(
    auth: AuthContext,
    relationshipId: string,
    planId: string,
    objectiveId: string,
    input: PlanObjectiveRequest,
  ) {
    const organization = this.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      await this.draftPlan(tx, relationshipId, planId);
      const [before] = await tx
        .select()
        .from(schema.planObjective)
        .where(
          and(
            eq(schema.planObjective.id, objectiveId),
            eq(schema.planObjective.planId, planId),
            eq(schema.planObjective.relationshipId, relationshipId),
          ),
        );
      if (!before) throw notFound();
      const permissions = await this.relationshipPermissions(
        tx,
        auth,
        organization.id,
        relationshipId,
      );
      const canEdit = permissions.canManage ||
        (permissions.isTeamMember && before.ownerUserId === auth.userId);
      if (!canEdit) {
        throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
      }
      if (!permissions.canManage && input.ownerUserId !== before.ownerUserId) {
        throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
      }
      await this.validateObjective(tx, organization.id, relationshipId, input, before.categoryKey);
      const actor = await actorOf(tx, auth, organization.id);
      return auditedChange(tx, actor, planObjectiveAudit, async () => {
        const [updated] = await tx
          .update(schema.planObjective)
          .set({
            categoryKey: input.categoryKey,
            businessUnitId: input.businessUnitId,
            materialGroupId: input.materialGroupId,
            text: input.text,
            ownerUserId: input.ownerUserId,
            targetYear: input.targetYear,
          })
          .where(eq(schema.planObjective.id, objectiveId))
          .returning({ id: schema.planObjective.id });
        if (!updated) throw notFound();
        return {
          objectId: objectiveId,
          relationshipId,
          action: 'updated',
          before: objectiveAuditValue(before),
          after: objectiveAuditValue(input),
          result: updated,
        };
      });
    });
  }

  private categoryEditor(auth: AuthContext): AccountOrganization {
    const organization = this.organization(auth);
    if (!can(auth, 'stammdaten.verwalten')) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    return organization;
  }

  async relationshipPermissions(
    tx: TenantTransaction,
    auth: AuthContext,
    organizationId: string,
    relationshipId: string,
  ) {
    const [membership] = await tx
      .select({ teamRole: schema.relationshipMember.teamRole })
      .from(schema.relationshipMember)
      .where(
        and(
          eq(schema.relationshipMember.relationshipId, relationshipId),
          eq(schema.relationshipMember.orgId, organizationId),
          eq(schema.relationshipMember.userId, auth.userId),
        ),
      );
    const canManage =
      can(auth, 'lieferantenplan.bearbeiten', { teamRole: membership?.teamRole ?? null }) &&
      (auth.orgRole === 'admin' || membership?.teamRole === 'sro');
    return {
      canManage,
      isTeamMember:
        can(auth, 'lieferantenplan.bearbeiten', { teamRole: membership?.teamRole ?? null }) &&
        membership !== undefined &&
        membership.teamRole !== 'viewer',
    };
  }

  private async requirePlanManager(
    tx: TenantTransaction,
    auth: AuthContext,
    organizationId: string,
    relationshipId: string,
  ) {
    if (!(await this.relationshipPermissions(tx, auth, organizationId, relationshipId)).canManage) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
  }

  async draftPlan(tx: TenantTransaction, relationshipId: string, planId: string) {
    const [plan] = await tx
      .select()
      .from(schema.supplierPlan)
      .where(
        and(
          eq(schema.supplierPlan.id, planId),
          eq(schema.supplierPlan.relationshipId, relationshipId),
        ),
      );
    if (!plan) throw notFound();
    if (plan.status !== 'draft') {
      throw conflict('plan_not_editable', 'Nur Entwürfe können bearbeitet werden.');
    }
    return plan;
  }

  async validateObjective(
    tx: TenantTransaction,
    organizationId: string,
    relationshipId: string,
    input: PlanObjectiveRequest,
    allowInactiveCategoryKey?: string,
  ) {
    const [category] = await tx
      .select({
        key: schema.objectiveCategory.key,
        active: schema.objectiveCategory.active,
      })
      .from(schema.objectiveCategory)
      .where(
        and(
          eq(schema.objectiveCategory.orgId, organizationId),
          eq(schema.objectiveCategory.key, input.categoryKey),
        ),
      );
    if (
      !category ||
      (!category.active && input.categoryKey !== allowInactiveCategoryKey)
    ) {
      throw conflict('category_inactive', 'Die Zielkategorie ist nicht aktiv.');
    }
    await this.validateReference(tx, organizationId, relationshipId, input);
  }

  /** Bezug und Verantwortliche müssen zur Beziehung gehören (SPL-01, SPL-03). */
  async validateReference(
    tx: TenantTransaction,
    organizationId: string,
    relationshipId: string,
    input: Pick<PlanObjectiveRequest, 'businessUnitId' | 'materialGroupId' | 'ownerUserId'>,
  ) {
    if (input.businessUnitId) {
      const [assignment] = await tx
        .select({ id: schema.relationshipBusinessUnit.id })
        .from(schema.relationshipBusinessUnit)
        .innerJoin(
          schema.businessUnit,
          eq(schema.businessUnit.id, schema.relationshipBusinessUnit.businessUnitId),
        )
        .where(
          and(
            eq(schema.relationshipBusinessUnit.relationshipId, relationshipId),
            eq(schema.relationshipBusinessUnit.businessUnitId, input.businessUnitId),
            eq(schema.businessUnit.orgId, organizationId),
          ),
        );
      if (!assignment) throw conflict('invalid_reference', 'Die Business Unit ist nicht zugeordnet.');
    } else if (input.materialGroupId) {
      const [assignment] = await tx
        .select({ id: schema.relationshipMaterialGroup.id })
        .from(schema.relationshipMaterialGroup)
        .innerJoin(
          schema.materialGroup,
          eq(schema.materialGroup.id, schema.relationshipMaterialGroup.materialGroupId),
        )
        .where(
          and(
            eq(schema.relationshipMaterialGroup.relationshipId, relationshipId),
            eq(schema.relationshipMaterialGroup.materialGroupId, input.materialGroupId),
            eq(schema.materialGroup.orgId, organizationId),
          ),
        );
      if (!assignment) throw conflict('invalid_reference', 'Die Warengruppe ist nicht zugeordnet.');
    }

    const [owner] = await tx
      .select({ teamRole: schema.relationshipMember.teamRole })
      .from(schema.relationshipMember)
      .where(
        and(
          eq(schema.relationshipMember.relationshipId, relationshipId),
          eq(schema.relationshipMember.orgId, organizationId),
          eq(schema.relationshipMember.userId, input.ownerUserId),
        ),
      );
    if (!owner || owner.teamRole === 'viewer') {
      throw conflict('invalid_owner', 'Verantwortlich kann nur ein Teammitglied sein.');
    }
  }

  async teamCandidatesIn(
    tx: TenantTransaction,
    organizationId: string,
    relationshipId: string,
  ) {
    const members = await tx
      .select({
        userId: schema.relationshipMember.userId,
        name: schema.appUser.name,
        teamRole: schema.relationshipMember.teamRole,
      })
      .from(schema.relationshipMember)
      .innerJoin(schema.appUser, eq(schema.appUser.id, schema.relationshipMember.userId))
      .where(
        and(
          eq(schema.relationshipMember.relationshipId, relationshipId),
          eq(schema.relationshipMember.orgId, organizationId),
        ),
      )
      .orderBy(asc(schema.appUser.name));
    return members
      .filter((member) => member.teamRole !== 'viewer')
      .map(({ userId, name }) => ({ userId, name }));
  }
}

function objectiveAuditValue(value: {
  categoryKey: string;
  businessUnitId: string | null;
  materialGroupId: string | null;
  text: string;
  ownerUserId: string;
  targetYear: number;
}) {
  return {
    category_key: value.categoryKey,
    business_unit_id: value.businessUnitId,
    material_group_id: value.materialGroupId,
    text: value.text,
    owner_user_id: value.ownerUserId,
    target_year: value.targetYear,
  };
}
