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
  currentTime,
  desc,
  eq,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type DecideJbp,
  type DueItem,
  type JbpApprovalView,
  type JbpContent,
  type JbpVersions,
  jbpApprovalViewSchema,
  jbpContentSchema,
  jbpVersionsSchema,
} from '@reziproq/shared';
import { ActionsService } from '../actions/actions.service.js';
import { actorOf } from '../audit/actor.js';
import { jbpAudit, jbpReviewRequestAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { EmailService } from '../email/email.service.js';
import type { JbpScope } from './jbp.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const conflict = (code: string) => new ConflictException({ statusCode: 409, code });

/** Frist für die Prüfung durch den Lieferanten. */
const reviewDays = 14;

type Plan = { id: string; status: 'draft' | 'in_review' | 'approved'; version: number };

/**
 * JBP-06: Freigabe des Gemeinsamen Plans. Der SRO gibt den Plan zur Prüfung (damit stimmt der
 * Käufer dieser Version zu), der Lieferant gibt frei oder mit Begründung zurück. Erst mit beiden
 * Freigaben gilt der Plan; der Inhalt wird als Version eingefroren. Den Status ändert für beide
 * Seiten die Funktion app_jbp_transition (Migration 0048), die die Übergänge selbst prüft.
 */
@Injectable()
export class JbpApprovalService {
  constructor(
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(ActionsService) private readonly actions: ActionsService,
  ) {}

  private async plan(tx: TenantTransaction, relationshipId: string): Promise<Plan | null> {
    const [row] = await tx
      .select({ id: schema.jbp.id, status: schema.jbp.status, version: schema.jbp.version })
      .from(schema.jbp)
      .where(eq(schema.jbp.relationshipId, relationshipId))
      .orderBy(desc(schema.jbp.version))
      .limit(1);
    return row ?? null;
  }

  /** SRO oder Admin beim Käufer, wie beim Anlegen des Plans (JBP-01). */
  private buyerLead(scope: JbpScope) {
    return (
      scope.side === 'buyer' &&
      can(scope.auth, 'jbp.anlegen', { teamRole: scope.teamRole }) &&
      (scope.auth.orgRole === 'admin' || scope.teamRole === 'sro')
    );
  }

  private supplierEditor(scope: JbpScope) {
    return scope.side === 'supplier' && can(scope.auth, 'jbp.bearbeiten');
  }

  async view(scope: JbpScope): Promise<JbpApprovalView> {
    const { tx } = scope;
    const plan = await this.plan(tx, scope.relationshipId);
    const decisions = plan
      ? await tx
          .select()
          .from(schema.jbpApproval)
          .where(
            and(
              eq(schema.jbpApproval.jbpId, plan.id),
              eq(schema.jbpApproval.version, plan.version),
            ),
          )
          .orderBy(desc(schema.jbpApproval.decidedAt))
      : [];
    const [frozen] =
      plan?.status === 'approved'
        ? await tx
            .select({ approvedAt: schema.jbpVersion.approvedAt })
            .from(schema.jbpVersion)
            .where(
              and(
                eq(schema.jbpVersion.jbpId, plan.id),
                eq(schema.jbpVersion.version, plan.version),
              ),
            )
        : [];
    return jbpApprovalViewSchema.parse({
      hasPlan: Boolean(plan),
      ownSide: scope.side,
      status: plan?.status ?? 'draft',
      version: plan?.version ?? 1,
      decisions: decisions.map((row) => ({
        id: row.id,
        version: row.version,
        side: row.side,
        userName: row.userName,
        decision: row.decision,
        comment: row.comment,
        decidedAt: row.decidedAt.toISOString(),
      })),
      approvedAt: frozen?.approvedAt.toISOString() ?? null,
      canSubmit: plan?.status === 'draft' && this.buyerLead(scope),
      canDecide: plan?.status === 'in_review' && this.supplierEditor(scope),
      canNewVersion:
        plan?.status === 'approved' && (this.buyerLead(scope) || this.supplierEditor(scope)),
    });
  }

  private async transition(tx: TenantTransaction, planId: string, to: string) {
    try {
      await tx.execute(sql`select app_jbp_transition(${planId}, ${to})`);
    } catch (error) {
      const message = String((error as { cause?: { message?: string } }).cause?.message ?? error);
      if (message.includes('not_allowed')) throw conflict('uebergang_nicht_erlaubt');
      throw error;
    }
  }

  private async decision(
    scope: JbpScope,
    plan: Plan,
    decision: 'approved' | 'returned',
    comment: string | null,
  ) {
    const actor = await actorOf(scope.tx, scope.auth, scope.orgId);
    await scope.tx.insert(schema.jbpApproval).values({
      relationshipId: scope.relationshipId,
      ownerOrgId: scope.orgId,
      visibility: 'shared',
      jbpId: plan.id,
      version: plan.version,
      side: scope.side,
      userId: scope.auth.userId,
      userName: actor.name,
      decision,
      comment,
    });
    return actor;
  }

  /** Zur Prüfung geben: Der Käufer stimmt dieser Version zu, der Lieferant bekommt Mail und Aufgabe. */
  async submit(scope: JbpScope): Promise<JbpApprovalView> {
    if (!this.buyerLead(scope)) throw forbidden();
    const { tx } = scope;
    const plan = await this.plan(tx, scope.relationshipId);
    if (!plan) throw notFound();
    if (plan.status !== 'draft') throw conflict('plan_nicht_im_entwurf');
    const actor = await this.decision(scope, plan, 'approved', null);
    await auditedChange(tx, actor, jbpAudit, async () => {
      await this.transition(tx, plan.id, 'in_review');
      return {
        objectId: plan.id,
        relationshipId: scope.relationshipId,
        action: 'updated' as const,
        before: { version: plan.version, status: plan.status },
        after: { version: plan.version, status: 'in_review' },
        result: undefined,
      };
    });
    // Mail an die Personen des Lieferanten, die der Käufer eingeladen hat und die angenommen haben.
    const [buyer] = await tx
      .select({ name: schema.organization.name })
      .from(schema.organization)
      .where(eq(schema.organization.id, scope.orgId));
    const recipients = await tx
      .select({ email: schema.invitation.email, userId: schema.invitation.acceptedUserId })
      .from(schema.invitation)
      .where(
        and(
          eq(schema.invitation.relationshipId, scope.relationshipId),
          sql`${schema.invitation.acceptedUserId} is not null`,
          sql`${schema.invitation.revokedAt} is null`,
        ),
      )
      .orderBy(asc(schema.invitation.email));
    const deadline = new Date(currentTime().getTime() + reviewDays * 86_400_000)
      .toISOString()
      .slice(0, 10);
    for (const recipient of recipients) {
      await auditedChange(tx, actor, jbpReviewRequestAudit, async () => ({
        objectId: `${plan.id}:${recipient.userId}`,
        relationshipId: scope.relationshipId,
        action: 'created' as const,
        after: { recipient: recipient.email, version: plan.version },
        result: undefined,
        email: this.email.prepare({
          recipient: recipient.email,
          template: 'approval',
          locale: 'de',
          title: `Gemeinsamer Plan ${buyer?.name ?? ''}`.trim(),
          deadline,
          link: `/kunden/${scope.relationshipId}/plan/freigabe`,
        }),
      }));
    }
    return this.view(scope);
  }

  /** Der Lieferant gibt frei oder mit Begründung zurück. */
  async decide(scope: JbpScope, input: DecideJbp): Promise<JbpApprovalView> {
    if (!this.supplierEditor(scope)) throw forbidden();
    const { tx } = scope;
    const plan = await this.plan(tx, scope.relationshipId);
    if (!plan) throw notFound();
    if (plan.status !== 'in_review') throw conflict('plan_nicht_in_pruefung');
    const actor = await this.decision(scope, plan, input.decision, input.comment);
    const to = input.decision === 'approved' ? 'approved' : 'draft';
    await auditedChange(tx, actor, jbpAudit, async () => {
      if (to === 'approved') {
        await tx.insert(schema.jbpVersion).values({
          relationshipId: scope.relationshipId,
          ownerOrgId: scope.orgId,
          visibility: 'shared',
          jbpId: plan.id,
          version: plan.version,
          content: await this.content(tx, plan.id),
          // ZA-01: Eine Version entsteht erst mit der Freigabe der zweiten Seite.
          confirmState: 'both_confirmed',
        });
      }
      await this.transition(tx, plan.id, to);
      return {
        objectId: plan.id,
        relationshipId: scope.relationshipId,
        action: to === 'approved' ? ('approved' as const) : ('updated' as const),
        before: { version: plan.version, status: plan.status },
        after: { version: plan.version, status: to },
        result: undefined,
      };
    });
    return this.view(scope);
  }

  /** Neue Version: Der Inhalt wird wieder änderbar und braucht erneut beide Freigaben. */
  async newVersion(scope: JbpScope): Promise<JbpApprovalView> {
    if (!this.buyerLead(scope) && !this.supplierEditor(scope)) throw forbidden();
    const { tx } = scope;
    const plan = await this.plan(tx, scope.relationshipId);
    if (!plan) throw notFound();
    if (plan.status !== 'approved') throw conflict('plan_nicht_freigegeben');
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    await auditedChange(tx, actor, jbpAudit, async () => {
      await this.transition(tx, plan.id, 'new_version');
      return {
        objectId: plan.id,
        relationshipId: scope.relationshipId,
        action: 'updated' as const,
        before: { version: plan.version, status: plan.status },
        after: { version: plan.version + 1, status: 'draft' },
        result: undefined,
      };
    });
    return this.view(scope);
  }

  async versions(scope: JbpScope): Promise<JbpVersions> {
    const plan = await this.plan(scope.tx, scope.relationshipId);
    const rows = plan
      ? await scope.tx
          .select()
          .from(schema.jbpVersion)
          .where(eq(schema.jbpVersion.jbpId, plan.id))
          .orderBy(desc(schema.jbpVersion.version))
      : [];
    return jbpVersionsSchema.parse({
      versions: rows.map((row) => ({
        version: row.version,
        approvedAt: row.approvedAt.toISOString(),
        content: row.content,
      })),
    });
  }

  /** Inhalt zum Einfrieren: Themen, Initiativen und Zusagen, wie beide Seiten sie sehen. */
  private async content(tx: TenantTransaction, planId: string): Promise<JbpContent> {
    const topics = await tx
      .select({
        title: schema.jbpTopic.title,
        side: schema.jbpTopic.side,
        status: schema.jbpTopic.status,
      })
      .from(schema.jbpTopic)
      .where(eq(schema.jbpTopic.jbpId, planId))
      .orderBy(asc(schema.jbpTopic.side), asc(schema.jbpTopic.priority));
    const initiatives = await tx
      .select({
        title: schema.initiative.title,
        goal: schema.initiative.goal,
        benefitBuyer: schema.initiative.benefitBuyer,
        benefitSupplier: schema.initiative.benefitSupplier,
        ownerBuyerName: schema.initiative.ownerBuyerName,
        ownerSupplierName: schema.initiative.ownerSupplierName,
        startsOn: schema.initiative.startsOn,
        endsOn: schema.initiative.endsOn,
      })
      .from(schema.initiative)
      .where(eq(schema.initiative.jbpId, planId))
      .orderBy(asc(schema.initiative.startsOn), asc(schema.initiative.title));
    const commitments = await tx
      .select({
        title: schema.commitment.title,
        side: schema.commitment.side,
        ownerName: schema.commitment.ownerName,
        dueOn: schema.commitment.dueOn,
      })
      .from(schema.commitment)
      .where(eq(schema.commitment.jbpId, planId))
      .orderBy(asc(schema.commitment.side), asc(schema.commitment.dueOn));
    return jbpContentSchema.parse({ topics, initiatives, commitments });
  }

  /** Start (JBP-06): Plan in Prüfung erscheint beim Lieferanten als Aufgabe. */
  async dueItems(auth: AuthContext): Promise<DueItem[]> {
    if (auth.organization?.buyer || !can(auth, 'jbp.bearbeiten')) return [];
    const items: DueItem[] = [];
    await this.actions.eachRelationship(
      auth,
      async (tx, entry) => {
        const plan = await this.plan(tx, entry.relationshipId);
        if (plan?.status !== 'in_review') return;
        const [submitted] = await tx
          .select({ at: schema.jbpApproval.decidedAt })
          .from(schema.jbpApproval)
          .where(
            and(
              eq(schema.jbpApproval.jbpId, plan.id),
              eq(schema.jbpApproval.version, plan.version),
              eq(schema.jbpApproval.side, 'buyer'),
            ),
          )
          .orderBy(desc(schema.jbpApproval.decidedAt))
          .limit(1);
        const due = new Date((submitted?.at ?? currentTime()).getTime() + reviewDays * 86_400_000);
        items.push({
          id: plan.id,
          kind: 'review',
          supplier: entry.counterpart,
          detail: null,
          dueDate: due.toISOString().slice(0, 10),
          href: `${entry.base}/plan/freigabe`,
        });
      },
      'jbp.sehen',
    );
    return items;
  }
}
