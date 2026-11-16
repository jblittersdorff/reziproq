import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  auditedChange,
  desc,
  eq,
  inArray,
  schema,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type DueItem,
  type PlanApprovalState,
  type PlanDecision,
  type PlanVersions,
  planVersionsSchema,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { planApprovalRequestAudit, supplierPlanAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { EmailService } from '../email/email.service.js';
import { ownRelationship } from '../suppliers/team.service.js';
import { copyPlan } from './copy-plan.js';
import { SupplierPlansService } from './supplier-plans.service.js';

const notFound = () =>
  new NotFoundException({ statusCode: 404, code: 'nicht_gefunden', message: 'Nicht gefunden.' });
const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const conflict = (code: string, message: string) =>
  new ConflictException({ statusCode: 409, code, message });

/** Eine Woche Zeit für die Freigabe, ab Einreichen (Frist unter „Fällig bei mir“). */
const reviewDays = 7;

type PlanRow = typeof schema.supplierPlan.$inferSelect;

/** Wer im Team der Beziehung SRO oder Sponsor ist (beim Käufer). */
async function approvers(tx: TenantTransaction, organizationId: string, relationshipId: string) {
  return tx
    .select({
      userId: schema.relationshipMember.userId,
      teamRole: schema.relationshipMember.teamRole,
      name: schema.appUser.name,
      email: schema.appUser.email,
      locale: schema.appUser.locale,
    })
    .from(schema.relationshipMember)
    .innerJoin(schema.appUser, eq(schema.appUser.id, schema.relationshipMember.userId))
    .where(
      and(
        eq(schema.relationshipMember.relationshipId, relationshipId),
        eq(schema.relationshipMember.orgId, organizationId),
        inArray(schema.relationshipMember.teamRole, ['sro', 'sponsor']),
      ),
    );
}

/**
 * Stand der Freigabe für die Plan-Seite (SPL-07). Freigegeben ist ein Plan, sobald in der laufenden
 * Runde der SRO und – falls es einen gibt – ein Sponsor zugestimmt haben.
 */
export async function approvalStateOf(
  tx: TenantTransaction,
  auth: AuthContext,
  organizationId: string,
  plan: PlanRow,
  options: { canManage: boolean; openContributions: number; topicCount: number },
): Promise<PlanApprovalState> {
  const team = await approvers(tx, organizationId, plan.relationshipId);
  const decisions = await tx
    .select()
    .from(schema.planApproval)
    .where(eq(schema.planApproval.planId, plan.id))
    .orderBy(desc(schema.planApproval.decidedAt));
  const role = team.find((member) => member.userId === auth.userId)?.teamRole;
  const decidedThisRound = decisions.some(
    (entry) => entry.round === plan.reviewRound && entry.userId === auth.userId,
  );
  const isSro = role === 'sro';
  return {
    round: plan.reviewRound,
    submittedAt: plan.submittedAt?.toISOString() ?? null,
    approvedAt: plan.approvedAt?.toISOString() ?? null,
    hasSponsor: team.some((member) => member.teamRole === 'sponsor'),
    decisions: decisions.map((entry) => ({
      userName: entry.userName,
      role: entry.role,
      decision: entry.decision,
      comment: entry.comment,
      decidedAt: entry.decidedAt.toISOString(),
      round: entry.round,
    })),
    hints: { openContributions: options.openContributions, noTopics: options.topicCount === 0 },
    canSubmit: plan.status === 'draft' && isSro && can(auth, 'lieferantenplan.bearbeiten'),
    canDecide:
      plan.status === 'in_review' &&
      (role === 'sro' || role === 'sponsor') &&
      !decidedThisRound &&
      can(auth, 'lieferantenplan.bearbeiten'),
    canNewVersion: plan.status === 'approved' && options.canManage,
  };
}

/** SPL-07: Einreichen, Freigeben oder Zurückgeben, neue Version, Versionen. Alles käuferintern. */
@Injectable()
export class PlanApprovalsService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(SupplierPlansService) private readonly plans: SupplierPlansService,
    @Inject(EmailService) private readonly email: EmailService,
  ) {}

  private run<T>(
    auth: AuthContext,
    relationshipId: string,
    work: (tx: TenantTransaction, organizationId: string) => Promise<T>,
  ) {
    const organization = this.plans.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await ownRelationship(tx, organization, relationshipId);
      return work(tx, organization.id);
    });
  }

  private async plan(tx: TenantTransaction, relationshipId: string, planId: string) {
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
    return plan;
  }

  private async supplierName(
    tx: TenantTransaction,
    organizationId: string,
    relationshipId: string,
  ) {
    const [row] = await tx
      .select({ name: schema.organization.name, display: schema.relationshipSide.displayName })
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
    return row?.display ?? row?.name ?? '';
  }

  /** Der SRO reicht den Entwurf ein; SRO und Sponsoren bekommen eine Mail (QS-01). */
  submit(auth: AuthContext, relationshipId: string, planId: string) {
    return this.run(auth, relationshipId, async (tx, organizationId) => {
      const plan = await this.plan(tx, relationshipId, planId);
      if (plan.status !== 'draft')
        throw conflict('plan_not_draft', 'Nur Entwürfe gehen in die Freigabe.');
      const team = await approvers(tx, organizationId, relationshipId);
      if (team.find((member) => member.userId === auth.userId)?.teamRole !== 'sro')
        throw forbidden();
      const supplier = await this.supplierName(tx, organizationId, relationshipId);
      const deadline = new Date(Date.now() + reviewDays * 86_400_000).toISOString().slice(0, 10);
      const actor = await actorOf(tx, auth, organizationId);
      const recipients = team.filter((member) => member.email);
      await auditedChange(tx, actor, supplierPlanAudit, async () => {
        await tx
          .update(schema.supplierPlan)
          .set({ status: 'in_review', reviewRound: plan.reviewRound + 1, submittedAt: new Date() })
          .where(eq(schema.supplierPlan.id, plan.id));
        return {
          objectId: plan.id,
          relationshipId,
          action: 'updated',
          before: { status: plan.status },
          after: { status: 'in_review' },
          result: undefined,
        };
      });
      // Je freigebende Person eine Anfrage mit Mail (QS-01); die Mail nennt nur Titel und Link.
      for (const member of recipients) {
        await auditedChange(tx, actor, planApprovalRequestAudit, async () => ({
          objectId: `${plan.id}:${member.userId}`,
          relationshipId,
          action: 'created' as const,
          after: { recipient: member.name, round: plan.reviewRound + 1 },
          result: undefined,
          email: this.email.prepare({
            recipient: member.email,
            template: 'approval',
            locale: member.locale ?? 'de',
            firstName: member.name.split(' ')[0] ?? member.name,
            title:
              (member.locale ?? 'de') === 'de'
                ? `Lieferantenplan ${supplier}`
                : `Supplier plan ${supplier}`,
            deadline,
            link: `/lieferanten/${relationshipId}/strategie/lieferantenplan/freigabe`,
          }),
        }));
      }
      return { status: 'in_review' as const };
    });
  }

  /**
   * SRO oder Sponsor entscheiden einmal je Runde. Zurückgeben setzt den Plan auf Entwurf; sind SRO
   * und ein Sponsor (oder ohne Sponsor der SRO allein) einverstanden, ist er freigegeben.
   */
  decide(auth: AuthContext, relationshipId: string, planId: string, input: PlanDecision) {
    return this.run(auth, relationshipId, async (tx, organizationId) => {
      const plan = await this.plan(tx, relationshipId, planId);
      if (plan.status !== 'in_review')
        throw conflict('plan_not_in_review', 'Der Plan ist nicht in Freigabe.');
      const team = await approvers(tx, organizationId, relationshipId);
      const me = team.find((member) => member.userId === auth.userId);
      if (!me || !can(auth, 'lieferantenplan.bearbeiten')) throw forbidden();
      const role = me.teamRole as 'sro' | 'sponsor';
      const actor = await actorOf(tx, auth, organizationId);
      return auditedChange(tx, actor, supplierPlanAudit, async () => {
        const inserted = await tx
          .insert(schema.planApproval)
          .values({
            relationshipId,
            planId,
            round: plan.reviewRound,
            userId: auth.userId,
            userName: me.name,
            role,
            decision: input.decision,
            comment: input.comment,
          })
          .onConflictDoNothing()
          .returning({ id: schema.planApproval.id });
        if (inserted.length === 0) throw conflict('already_decided', 'Du hast schon entschieden.');
        let status: 'draft' | 'in_review' | 'approved' = 'in_review';
        if (input.decision === 'returned') {
          status = 'draft';
        } else {
          const round = await tx
            .select({ role: schema.planApproval.role, decision: schema.planApproval.decision })
            .from(schema.planApproval)
            .where(
              and(
                eq(schema.planApproval.planId, planId),
                eq(schema.planApproval.round, plan.reviewRound),
              ),
            );
          const approved = (who: 'sro' | 'sponsor') =>
            round.some((entry) => entry.role === who && entry.decision === 'approved');
          const hasSponsor = team.some((member) => member.teamRole === 'sponsor');
          if (approved('sro') && (!hasSponsor || approved('sponsor'))) status = 'approved';
        }
        if (status !== 'in_review') {
          await tx
            .update(schema.supplierPlan)
            .set({ status, ...(status === 'approved' ? { approvedAt: new Date() } : {}) })
            .where(eq(schema.supplierPlan.id, planId));
        }
        return {
          objectId: planId,
          relationshipId,
          action: status === 'approved' ? ('approved' as const) : ('updated' as const),
          before: { status: plan.status },
          after: { status },
          result: { status },
        };
      });
    });
  }

  /**
   * Ändern nach der Freigabe: eine Kopie als neue Version im Entwurf (Zusammenfassung, Ziele,
   * Themen mit ihren Zielen); die freigegebene wird abgelöst und bleibt unverändert lesbar.
   */
  newVersion(auth: AuthContext, relationshipId: string, planId: string) {
    return this.run(auth, relationshipId, async (tx, organizationId) => {
      const plan = await this.plan(tx, relationshipId, planId);
      if (plan.status !== 'approved')
        throw conflict('plan_not_approved', 'Nur freigegebene Pläne bekommen eine neue Version.');
      const permissions = await this.plans.relationshipPermissions(
        tx,
        auth,
        organizationId,
        relationshipId,
      );
      if (!permissions.canManage) throw forbidden();
      const actor = await actorOf(tx, auth, organizationId);
      return auditedChange(tx, actor, supplierPlanAudit, async () => {
        await tx
          .update(schema.supplierPlan)
          .set({ status: 'superseded' })
          .where(eq(schema.supplierPlan.id, plan.id));
        const newId = await copyPlan(tx, plan, {
          cycleId: plan.cycleId,
          version: plan.version + 1,
        });
        return {
          objectId: newId,
          relationshipId,
          action: 'created' as const,
          after: { version: plan.version + 1, status: 'draft', summary: plan.summary },
          result: { id: newId },
        };
      });
    });
  }

  /** Alle Versionen des Plans im aktiven Zyklus, je mit Inhalt für den Vergleich. */
  versions(auth: AuthContext, relationshipId: string): Promise<PlanVersions> {
    return this.run(auth, relationshipId, async (tx, organizationId) => {
      const categories = await this.plans.ensureDefaultCategories(tx, organizationId);
      const categoryName = new Map(categories.map((entry) => [entry.key, entry.name]));
      const [cycle] = await tx
        .select({ id: schema.cycle.id })
        .from(schema.cycle)
        .where(
          and(eq(schema.cycle.relationshipId, relationshipId), eq(schema.cycle.status, 'active')),
        )
        .limit(1);
      if (!cycle) return planVersionsSchema.parse({ versions: [] });
      const plans = await tx
        .select()
        .from(schema.supplierPlan)
        .where(eq(schema.supplierPlan.cycleId, cycle.id))
        .orderBy(desc(schema.supplierPlan.version));
      const versions = [];
      for (const plan of plans) {
        const objectives = await tx
          .select({
            categoryKey: schema.planObjective.categoryKey,
            text: schema.planObjective.text,
            targetYear: schema.planObjective.targetYear,
            businessUnit: schema.businessUnit.name,
            materialGroup: schema.materialGroup.name,
          })
          .from(schema.planObjective)
          .leftJoin(
            schema.businessUnit,
            eq(schema.businessUnit.id, schema.planObjective.businessUnitId),
          )
          .leftJoin(
            schema.materialGroup,
            eq(schema.materialGroup.id, schema.planObjective.materialGroupId),
          )
          .where(eq(schema.planObjective.planId, plan.id))
          .orderBy(asc(schema.planObjective.text));
        const topics = await tx
          .select({
            title: schema.strategicTopic.title,
            reason: schema.strategicTopic.reason,
            priority: schema.strategicTopic.priority,
          })
          .from(schema.strategicTopic)
          .where(eq(schema.strategicTopic.planId, plan.id))
          .orderBy(asc(schema.strategicTopic.priority));
        versions.push({
          id: plan.id,
          version: plan.version,
          status: plan.status,
          approvedAt: plan.approvedAt?.toISOString() ?? null,
          summary: plan.summary,
          objectives: objectives.map((objective) => ({
            categoryName: categoryName.get(objective.categoryKey) ?? objective.categoryKey,
            reference: objective.businessUnit ?? objective.materialGroup ?? null,
            text: objective.text,
            targetYear: objective.targetYear,
          })),
          topics,
        });
      }
      return planVersionsSchema.parse({ versions });
    });
  }

  /** Aufgaben-Quelle (SPL-07): eingereichte Pläne, über die die Person noch entscheiden muss. */
  async dueItems(auth: AuthContext): Promise<DueItem[]> {
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'lieferantenplan.bearbeiten')) return [];
    return this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => {
        const rows = await tx
          .select({
            planId: schema.supplierPlan.id,
            relationshipId: schema.supplierPlan.relationshipId,
            round: schema.supplierPlan.reviewRound,
            submittedAt: schema.supplierPlan.submittedAt,
            name: schema.organization.name,
            display: schema.relationshipSide.displayName,
          })
          .from(schema.supplierPlan)
          .innerJoin(
            schema.relationshipMember,
            and(
              eq(schema.relationshipMember.relationshipId, schema.supplierPlan.relationshipId),
              eq(schema.relationshipMember.orgId, organization.id),
              eq(schema.relationshipMember.userId, auth.userId),
              inArray(schema.relationshipMember.teamRole, ['sro', 'sponsor']),
            ),
          )
          .innerJoin(
            schema.relationship,
            eq(schema.relationship.id, schema.supplierPlan.relationshipId),
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
          .where(eq(schema.supplierPlan.status, 'in_review'));
        const items: DueItem[] = [];
        for (const row of rows) {
          const [decided] = await tx
            .select({ id: schema.planApproval.id })
            .from(schema.planApproval)
            .where(
              and(
                eq(schema.planApproval.planId, row.planId),
                eq(schema.planApproval.round, row.round),
                eq(schema.planApproval.userId, auth.userId),
              ),
            );
          if (decided) continue;
          const submitted = row.submittedAt ?? new Date();
          items.push({
            id: row.planId,
            kind: 'approval',
            supplier: row.display ?? row.name,
            detail: null,
            dueDate: new Date(submitted.getTime() + reviewDays * 86_400_000)
              .toISOString()
              .slice(0, 10),
            href: `/lieferanten/${row.relationshipId}/strategie/lieferantenplan/freigabe`,
          });
        }
        return items;
      },
      { readOnly: true },
    );
  }
}
