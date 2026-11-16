import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, auditedChange, eq, inArray, schema, type TenantTransaction } from '@reziproq/db';
import {
  type ContributionDetail,
  type ContributionObjectiveRequest,
  type ContributionSuggestionsResponse,
  contributionDetailSchema,
  contributionSuggestionsResponseSchema,
  type DueItem,
  type RequestContributions,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { planContributionAudit, planObjectiveAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { EmailService } from '../email/email.service.js';
import { readDecisions } from '../ratings/consolidation.js';
import { ownRelationship } from '../suppliers/team.service.js';
import { readContributions } from './contributions.js';
import { SupplierPlansService } from './supplier-plans.service.js';

const notFound = () =>
  new NotFoundException({ statusCode: 404, code: 'nicht_gefunden', message: 'Nicht gefunden.' });
const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const conflict = (code: string, message: string) =>
  new ConflictException({ statusCode: 409, code, message });

const today = () => new Date().toISOString().slice(0, 10);

// Passende Funktionen je Bezug für den Vorschlag der Person (SPL-03).
const businessUnitFunctions = ['programs', 'engineering', 'after_sales'] as const;
const materialGroupFunctions = ['purchasing', 'quality', 'logistics', 'engineering'] as const;

/** Beiträge der Funktionen zum Lieferantenplan (SPL-03). Nur Käuferseite, nie Lieferanten. */
@Injectable()
export class PlanContributionsService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(SupplierPlansService) private readonly plans: SupplierPlansService,
    @Inject(EmailService) private readonly email: EmailService,
  ) {}

  private async manager(
    tx: TenantTransaction,
    auth: AuthContext,
    organizationId: string,
    relationshipId: string,
  ) {
    const permissions = await this.plans.relationshipPermissions(
      tx,
      auth,
      organizationId,
      relationshipId,
    );
    if (!permissions.canManage) throw forbidden();
  }

  async suggestions(
    auth: AuthContext,
    relationshipId: string,
    planId: string,
  ): Promise<ContributionSuggestionsResponse> {
    const organization = this.plans.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      await this.plans.draftPlan(tx, relationshipId, planId);
      await this.manager(tx, auth, organization.id, relationshipId);

      const units = await tx
        .select({ id: schema.businessUnit.id, name: schema.businessUnit.name })
        .from(schema.relationshipBusinessUnit)
        .innerJoin(
          schema.businessUnit,
          eq(schema.businessUnit.id, schema.relationshipBusinessUnit.businessUnitId),
        )
        .where(
          and(
            eq(schema.relationshipBusinessUnit.relationshipId, relationshipId),
            eq(schema.businessUnit.orgId, organization.id),
          ),
        )
        .orderBy(asc(schema.businessUnit.name));
      const groups = await tx
        .select({ id: schema.materialGroup.id, name: schema.materialGroup.name })
        .from(schema.relationshipMaterialGroup)
        .innerJoin(
          schema.materialGroup,
          eq(schema.materialGroup.id, schema.relationshipMaterialGroup.materialGroupId),
        )
        .where(
          and(
            eq(schema.relationshipMaterialGroup.relationshipId, relationshipId),
            eq(schema.materialGroup.orgId, organization.id),
          ),
        )
        .orderBy(asc(schema.materialGroup.name));
      const existing = await readContributions(tx, relationshipId, planId);
      const requestedUnits = new Set(existing.map((item) => item.businessUnit?.id));
      const requestedGroups = new Set(existing.map((item) => item.materialGroup?.id));

      const members = await tx
        .select({
          userId: schema.relationshipMember.userId,
          name: schema.appUser.name,
          teamRole: schema.relationshipMember.teamRole,
          defaultFunction: schema.appUser.defaultFunction,
        })
        .from(schema.relationshipMember)
        .innerJoin(schema.appUser, eq(schema.appUser.id, schema.relationshipMember.userId))
        .where(
          and(
            eq(schema.relationshipMember.relationshipId, relationshipId),
            eq(schema.relationshipMember.orgId, organization.id),
          ),
        )
        .orderBy(asc(schema.appUser.name));
      const team = members.filter((member) => member.teamRole !== 'viewer');
      const suggest = (functions: readonly string[]) => {
        for (const name of functions) {
          const match = team.find((member) => member.defaultFunction === name);
          if (match) return match.userId;
        }
        return (team.find((member) => member.teamRole === 'sro') ?? team[0])?.userId ?? null;
      };

      return contributionSuggestionsResponseSchema.parse({
        rows: [
          ...units
            .filter((unit) => !requestedUnits.has(unit.id))
            .map((unit) => ({
              businessUnit: unit,
              materialGroup: null,
              suggestedUserId: suggest(businessUnitFunctions),
            })),
          ...groups
            .filter((group) => !requestedGroups.has(group.id))
            .map((group) => ({
              businessUnit: null,
              materialGroup: group,
              suggestedUserId: suggest(materialGroupFunctions),
            })),
        ],
        teamCandidates: team.map(({ userId, name }) => ({ userId, name })),
      });
    });
  }

  /** Legt alle Beiträge in einem Schritt an; jede Person bekommt genau eine Mail. */
  async request(
    auth: AuthContext,
    relationshipId: string,
    planId: string,
    input: RequestContributions,
  ) {
    const organization = this.plans.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      await this.plans.draftPlan(tx, relationshipId, planId);
      await this.manager(tx, auth, organization.id, relationshipId);
      if (input.contributions.some((row) => row.dueDate < today())) {
        throw conflict('due_date_past', 'Die Frist liegt in der Vergangenheit.');
      }

      const team = new Set(
        (await this.plans.teamCandidatesIn(tx, organization.id, relationshipId)).map(
          (person) => person.userId,
        ),
      );
      for (const row of input.contributions) {
        if (!team.has(row.assigneeUserId)) {
          throw conflict('invalid_assignee', 'Zuständig kann nur ein Teammitglied sein.');
        }
        await this.plans.validateReference(tx, organization.id, relationshipId, {
          businessUnitId: row.businessUnitId,
          materialGroupId: row.materialGroupId,
          ownerUserId: row.assigneeUserId,
        });
      }

      const supplier = await this.supplierName(tx, organization.id, relationshipId);
      const userIds = [...new Set(input.contributions.map((row) => row.assigneeUserId))];
      const users = new Map(
        (
          await tx
            .select({
              id: schema.appUser.id,
              name: schema.appUser.name,
              givenName: schema.appUser.givenName,
              email: schema.appUser.email,
              locale: schema.appUser.locale,
            })
            .from(schema.appUser)
            .where(inArray(schema.appUser.id, userIds))
        ).map((user) => [user.id, user]),
      );
      const actor = await actorOf(tx, auth, organization.id);
      const mailed = new Set<string>();
      const created: string[] = [];
      for (const row of input.contributions) {
        const user = users.get(row.assigneeUserId);
        if (!user) throw conflict('invalid_assignee', 'Zuständig kann nur ein Teammitglied sein.');
        const own = input.contributions.filter((other) => other.assigneeUserId === user.id);
        const mail = !mailed.has(user.id);
        mailed.add(user.id);
        const id = await auditedChange(tx, actor, planContributionAudit, async () => {
          const [inserted] = await tx
            .insert(schema.planContribution)
            .values({
              relationshipId,
              planId,
              businessUnitId: row.businessUnitId,
              materialGroupId: row.materialGroupId,
              assigneeUserId: row.assigneeUserId,
              dueDate: row.dueDate,
            })
            .onConflictDoNothing()
            .returning({ id: schema.planContribution.id });
          if (!inserted) {
            throw conflict('contribution_exists', 'Für diesen Bezug gibt es schon einen Beitrag.');
          }
          return {
            objectId: inserted.id,
            relationshipId,
            action: 'created',
            after: contributionAuditValue(row),
            ...(mail
              ? {
                  email: this.email.prepare({
                    recipient: user.email,
                    template: 'reminder',
                    locale: user.locale ?? 'de',
                    firstName: user.givenName ?? user.name.split(' ')[0],
                    title:
                      (user.locale ?? 'de') === 'de'
                        ? `Beitrag zum Lieferantenplan ${supplier}`
                        : `Supplier plan contribution ${supplier}`,
                    deadline: own.map((item) => item.dueDate).sort()[0],
                    link:
                      own.length === 1
                        ? `/lieferanten/${relationshipId}/strategie/lieferantenplan/beitrag/${inserted.id}`
                        : `/lieferanten/${relationshipId}/strategie/lieferantenplan`,
                  }),
                }
              : {}),
            result: inserted.id,
          };
        });
        created.push(id);
      }
      return { ids: created };
    });
  }

  private async supplierName(
    tx: TenantTransaction,
    organizationId: string,
    relationshipId: string,
  ) {
    const [row] = await tx
      .select({ name: schema.organization.name, displayName: schema.relationshipSide.displayName })
      .from(schema.relationship)
      .innerJoin(schema.organization, eq(schema.organization.id, schema.relationship.supplierOrgId))
      .leftJoin(
        schema.relationshipSide,
        and(
          eq(schema.relationshipSide.relationshipId, schema.relationship.id),
          eq(schema.relationshipSide.orgId, organizationId),
        ),
      )
      .where(eq(schema.relationship.id, relationshipId));
    return row?.displayName ?? row?.name ?? '';
  }

  private async loadOwn(
    tx: TenantTransaction,
    auth: AuthContext,
    relationshipId: string,
    contributionId: string,
  ) {
    const [row] = await tx
      .select()
      .from(schema.planContribution)
      .where(
        and(
          eq(schema.planContribution.id, contributionId),
          eq(schema.planContribution.relationshipId, relationshipId),
        ),
      );
    if (!row) throw notFound();
    return { row, own: row.assigneeUserId === auth.userId };
  }

  async get(
    auth: AuthContext,
    relationshipId: string,
    contributionId: string,
  ): Promise<ContributionDetail> {
    const organization = this.plans.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      const { row, own } = await this.loadOwn(tx, auth, relationshipId, contributionId);
      const permissions = await this.plans.relationshipPermissions(
        tx,
        auth,
        organization.id,
        relationshipId,
      );
      if (!own && !permissions.canManage) throw forbidden();
      const [plan] = await tx
        .select()
        .from(schema.supplierPlan)
        .where(eq(schema.supplierPlan.id, row.planId));
      if (!plan) throw notFound();
      const [item] = await readContributions(tx, relationshipId, plan.id, contributionId);
      if (!item) throw notFound();
      const categories = (await this.plans.ensureDefaultCategories(tx, organization.id)).filter(
        (category) => category.active,
      );
      const categoryNames = new Map(categories.map((category) => [category.key, category.name]));
      const objectives = await tx
        .select({
          id: schema.planObjective.id,
          categoryKey: schema.planObjective.categoryKey,
          text: schema.planObjective.text,
          ownerUserId: schema.planObjective.ownerUserId,
          ownerName: schema.appUser.name,
          targetYear: schema.planObjective.targetYear,
        })
        .from(schema.planObjective)
        .innerJoin(schema.appUser, eq(schema.appUser.id, schema.planObjective.ownerUserId))
        .where(
          and(
            eq(schema.planObjective.planId, plan.id),
            row.businessUnitId
              ? eq(schema.planObjective.businessUnitId, row.businessUnitId)
              : eq(schema.planObjective.materialGroupId, row.materialGroupId ?? ''),
          ),
        )
        .orderBy(asc(schema.planObjective.targetYear), asc(schema.planObjective.text));
      const decisions = await readDecisions(tx, organization.id, relationshipId);
      return contributionDetailSchema.parse({
        id: item.id,
        planId: plan.id,
        relationshipId,
        businessUnit: item.businessUnit,
        materialGroup: item.materialGroup,
        assignee: item.assignee,
        dueDate: item.dueDate,
        status: item.status,
        summary: plan.summary,
        targetType:
          decisions[0]?.entries.find((entry) => entry.scope === 'total')?.soll.typeName ?? null,
        categories,
        objectives: objectives.map((objective) => ({
          id: objective.id,
          categoryKey: objective.categoryKey,
          categoryName: categoryNames.get(objective.categoryKey) ?? objective.categoryKey,
          businessUnit: item.businessUnit,
          materialGroup: item.materialGroup,
          text: objective.text,
          owner: { userId: objective.ownerUserId, name: objective.ownerName },
          targetYear: objective.targetYear,
          canEdit: false,
        })),
        canEdit: own && item.status === 'open' && plan.status === 'draft',
      });
    });
  }

  /** Das Ziel erhält Bezug und Verantwortliche aus dem Beitrag; beides lässt sich nicht wählen. */
  async createObjective(
    auth: AuthContext,
    relationshipId: string,
    contributionId: string,
    input: ContributionObjectiveRequest,
  ) {
    const organization = this.plans.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      const { row, own } = await this.loadOwn(tx, auth, relationshipId, contributionId);
      if (!own) throw forbidden();
      await this.plans.draftPlan(tx, relationshipId, row.planId);
      if (row.status !== 'open') {
        throw conflict('contribution_done', 'Der Beitrag ist bereits abgeschlossen.');
      }
      const value = {
        categoryKey: input.categoryKey,
        businessUnitId: row.businessUnitId,
        materialGroupId: row.materialGroupId,
        text: input.text,
        ownerUserId: auth.userId,
        targetYear: input.targetYear,
      };
      await this.plans.ensureDefaultCategories(tx, organization.id);
      await this.plans.validateObjective(tx, organization.id, relationshipId, value);
      const actor = await actorOf(tx, auth, organization.id);
      const id = await auditedChange(tx, actor, planObjectiveAudit, async () => {
        const [created] = await tx
          .insert(schema.planObjective)
          .values({ relationshipId, planId: row.planId, ...value })
          .returning({ id: schema.planObjective.id });
        if (!created) throw notFound();
        return {
          objectId: created.id,
          relationshipId,
          action: 'created',
          after: {
            category_key: value.categoryKey,
            business_unit_id: value.businessUnitId,
            material_group_id: value.materialGroupId,
            text: value.text,
            owner_user_id: value.ownerUserId,
            target_year: value.targetYear,
          },
          result: created.id,
        };
      });
      return { id };
    });
  }

  async complete(auth: AuthContext, relationshipId: string, contributionId: string) {
    const organization = this.plans.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      const { row, own } = await this.loadOwn(tx, auth, relationshipId, contributionId);
      if (!own) throw forbidden();
      await this.plans.draftPlan(tx, relationshipId, row.planId);
      if (row.status !== 'open') {
        throw conflict('contribution_done', 'Der Beitrag ist bereits abgeschlossen.');
      }
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, planContributionAudit, async () => {
        await tx
          .update(schema.planContribution)
          .set({ status: 'done', doneAt: new Date() })
          .where(eq(schema.planContribution.id, contributionId));
        return {
          objectId: contributionId,
          relationshipId,
          action: 'updated',
          before: { status: 'open' },
          after: { status: 'done' },
          result: undefined,
        };
      });
      return { id: contributionId };
    });
  }

  /** "Fällig bei mir" (NAV-05): offene Beiträge der Person in Plänen im Entwurf. */
  async dueItems(auth: AuthContext): Promise<DueItem[]> {
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'lieferanten.sehen')) return [];
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const rows = await tx
        .select({
          id: schema.planContribution.id,
          relationshipId: schema.planContribution.relationshipId,
          dueDate: schema.planContribution.dueDate,
          supplier: schema.organization.name,
          displayName: schema.relationshipSide.displayName,
          businessUnit: schema.businessUnit.name,
          materialGroup: schema.materialGroup.name,
        })
        .from(schema.planContribution)
        .innerJoin(schema.supplierPlan, eq(schema.supplierPlan.id, schema.planContribution.planId))
        .innerJoin(
          schema.relationship,
          eq(schema.relationship.id, schema.planContribution.relationshipId),
        )
        .innerJoin(
          schema.organization,
          eq(schema.organization.id, schema.relationship.supplierOrgId),
        )
        .leftJoin(
          schema.relationshipSide,
          and(
            eq(schema.relationshipSide.relationshipId, schema.relationship.id),
            eq(schema.relationshipSide.orgId, organization.id),
          ),
        )
        .leftJoin(
          schema.businessUnit,
          eq(schema.businessUnit.id, schema.planContribution.businessUnitId),
        )
        .leftJoin(
          schema.materialGroup,
          eq(schema.materialGroup.id, schema.planContribution.materialGroupId),
        )
        .where(
          and(
            eq(schema.planContribution.assigneeUserId, auth.userId),
            eq(schema.planContribution.status, 'open'),
            eq(schema.supplierPlan.status, 'draft'),
            eq(schema.relationship.buyerOrgId, organization.id),
          ),
        );
      return rows.map((row) => ({
        id: row.id,
        kind: 'contribution' as const,
        supplier: row.displayName ?? row.supplier,
        detail: row.businessUnit ?? row.materialGroup,
        dueDate: row.dueDate,
        href: `/lieferanten/${row.relationshipId}/strategie/lieferantenplan/beitrag/${row.id}`,
      }));
    });
  }
}

function contributionAuditValue(row: {
  businessUnitId: string | null;
  materialGroupId: string | null;
  assigneeUserId: string;
  dueDate: string;
}) {
  return {
    business_unit_id: row.businessUnitId,
    material_group_id: row.materialGroupId,
    assignee_user_id: row.assigneeUserId,
    due_date: row.dueDate,
    status: 'open',
  };
}
