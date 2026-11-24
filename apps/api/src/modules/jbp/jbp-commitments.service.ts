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
  asc,
  auditedChange,
  currentTime,
  desc,
  eq,
  inArray,
  or,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type Commitment,
  type CommitmentStatus,
  type Commitments,
  commitmentsSchema,
  type DueItem,
  type SaveCommitment,
} from '@reziproq/shared';
import { ActionsService } from '../actions/actions.service.js';
import { actorOf } from '../audit/actor.js';
import { commitmentAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import type { JbpScope } from './jbp.service.js';
import { teamPeople } from './people.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

type CommitmentRow = typeof schema.commitment.$inferSelect;

/** Heute als ISO-Datum; überfällig ist eine offene Zusage mit Frist vor heute. */
const today = () => currentTime().toISOString().slice(0, 10);

async function currentPlan(tx: TenantTransaction, relationshipId: string) {
  const [row] = await tx
    .select({ id: schema.jbp.id, status: schema.jbp.status })
    .from(schema.jbp)
    .where(eq(schema.jbp.relationshipId, relationshipId))
    .orderBy(desc(schema.jbp.version))
    .limit(1);
  return row ?? null;
}

const snapshot = (row: CommitmentRow, initiativeTitle: string | null) => ({
  title: row.title,
  owner_name: row.ownerName,
  due_on: row.dueOn,
  status: row.status,
  initiative: initiativeTitle,
});

/**
 * JBP-05: Zusagen beider Seiten. Jede Seite legt nur ihre eigenen Zusagen an, bearbeitet sie und
 * setzt ihren Status (PLT-04). Verantwortlich ist eine Person der eigenen Seite. Offene Zusagen und
 * offene Meilensteine eigener Initiativen erscheinen auf Start der verantwortlichen Person.
 */
@Injectable()
export class JbpCommitmentsService {
  constructor(@Inject(ActionsService) private readonly actions: ActionsService) {}

  canEdit(scope: JbpScope) {
    if (!can(scope.auth, 'jbp.bearbeiten', { teamRole: scope.teamRole })) return false;
    return scope.side === 'supplier' || scope.auth.orgRole === 'admin' || scope.teamRole !== null;
  }

  async list(scope: JbpScope): Promise<Commitments> {
    const { tx } = scope;
    const plan = await currentPlan(tx, scope.relationshipId);
    const rows = plan
      ? await tx
          .select()
          .from(schema.commitment)
          .where(eq(schema.commitment.jbpId, plan.id))
          .orderBy(asc(schema.commitment.dueOn), asc(schema.commitment.createdAt))
      : [];
    const initiatives = plan
      ? await tx
          .select({ id: schema.initiative.id, title: schema.initiative.title })
          .from(schema.initiative)
          .where(eq(schema.initiative.jbpId, plan.id))
          .orderBy(asc(schema.initiative.startsOn))
      : [];
    const day = today();
    const toCommitment = (row: CommitmentRow): Commitment => {
      const initiative = initiatives.find((entry) => entry.id === row.initiativeId);
      return {
        id: row.id,
        side: row.side,
        own: row.ownerOrgId === scope.orgId,
        title: row.title,
        ownerUserId: row.ownerUserId,
        ownerName: row.ownerName,
        dueOn: row.dueOn,
        status: row.status,
        overdue: row.status === 'open' && row.dueOn < day,
        initiative: initiative ? { id: initiative.id, title: initiative.title } : null,
      };
    };
    // Überfällige stehen oben, danach nach Frist.
    const side = (key: 'buyer' | 'supplier') =>
      rows
        .filter((row) => row.side === key)
        .map(toCommitment)
        .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueOn.localeCompare(b.dueOn));
    const canEdit = Boolean(plan) && this.canEdit(scope);
    return commitmentsSchema.parse({
      hasPlan: Boolean(plan),
      ownSide: scope.side,
      canEdit,
      people: canEdit
        ? await teamPeople(tx, scope.relationshipId, scope.orgId, scope.auth.userId)
        : [],
      initiatives,
      buyer: side('buyer'),
      supplier: side('supplier'),
    });
  }

  private async prepare(scope: JbpScope, input: SaveCommitment) {
    if (!this.canEdit(scope)) throw forbidden();
    const plan = await currentPlan(scope.tx, scope.relationshipId);
    if (!plan) throw notFound();
    // JBP-06: Nach der Freigabe ändert sich der Inhalt nur über eine neue Version; Status bleibt.
    if (plan.status === 'approved') {
      throw new ConflictException({ statusCode: 409, code: 'plan_freigegeben' });
    }
    const people = await teamPeople(scope.tx, scope.relationshipId, scope.orgId, scope.auth.userId);
    const owner = people.find((person) => person.userId === input.ownerUserId);
    if (!owner) throw new BadRequestException({ statusCode: 400, code: 'person_unbekannt' });
    let initiativeTitle: string | null = null;
    if (input.initiativeId) {
      const [initiative] = await scope.tx
        .select({ title: schema.initiative.title })
        .from(schema.initiative)
        .where(
          and(eq(schema.initiative.id, input.initiativeId), eq(schema.initiative.jbpId, plan.id)),
        );
      if (!initiative) {
        throw new BadRequestException({ statusCode: 400, code: 'initiative_unbekannt' });
      }
      initiativeTitle = initiative.title;
    }
    return { plan, owner, initiativeTitle };
  }

  private async titleOf(tx: TenantTransaction, initiativeId: string | null) {
    if (!initiativeId) return null;
    const [row] = await tx
      .select({ title: schema.initiative.title })
      .from(schema.initiative)
      .where(eq(schema.initiative.id, initiativeId));
    return row?.title ?? null;
  }

  async create(scope: JbpScope, input: SaveCommitment): Promise<Commitments> {
    const { plan, owner, initiativeTitle } = await this.prepare(scope, input);
    const { tx } = scope;
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    await auditedChange(tx, actor, commitmentAudit, async () => {
      const [row] = await tx
        .insert(schema.commitment)
        .values({
          relationshipId: scope.relationshipId,
          ownerOrgId: scope.orgId,
          visibility: 'shared',
          jbpId: plan.id,
          initiativeId: input.initiativeId,
          side: scope.side,
          title: input.title,
          ownerUserId: owner.userId,
          ownerName: owner.name,
          dueOn: input.dueOn,
          createdBy: scope.auth.userId,
          createdByName: actor.name,
        })
        .returning();
      const created = row as CommitmentRow;
      return {
        objectId: created.id,
        relationshipId: scope.relationshipId,
        action: 'created' as const,
        after: snapshot(created, initiativeTitle),
        result: undefined,
      };
    });
    return this.list(scope);
  }

  /**
   * KI-17: Zusage aus den Ergebnissen eines Termins, zunächst intern; erst „Protokoll teilen“ macht
   * sie für die andere Seite sichtbar. Nur in einen Plan, der noch nicht freigegeben ist (JBP-06);
   * sonst null, und die Ergebnisse legen eine Maßnahme an.
   */
  async createFromMeeting(
    scope: JbpScope,
    input: {
      side: 'buyer' | 'supplier';
      title: string;
      ownerUserId: string | null;
      ownerName: string;
      dueOn: string;
    },
  ): Promise<string | null> {
    if (!this.canEdit(scope)) throw forbidden();
    const plan = await currentPlan(scope.tx, scope.relationshipId);
    if (!plan || plan.status === 'approved') return null;
    const { tx } = scope;
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    return auditedChange(tx, actor, commitmentAudit, async () => {
      const [row] = await tx
        .insert(schema.commitment)
        .values({
          relationshipId: scope.relationshipId,
          ownerOrgId: scope.orgId,
          visibility: 'internal',
          jbpId: plan.id,
          initiativeId: null,
          side: input.side,
          title: input.title.slice(0, 200),
          ownerUserId: input.ownerUserId,
          ownerName: input.ownerName,
          dueOn: input.dueOn,
          createdBy: scope.auth.userId,
          createdByName: actor.name,
        })
        .returning();
      const created = row as CommitmentRow;
      return {
        objectId: created.id,
        relationshipId: scope.relationshipId,
        action: 'created' as const,
        after: snapshot(created, null),
        result: created.id,
      };
    });
  }

  /** KI-17: Beim Teilen des Protokolls wird eine eigene Zusage aus dem Termin geteilt. */
  async shareFromMeeting(scope: JbpScope, commitmentId: string) {
    const before = await this.own(scope, commitmentId);
    if (before.visibility === 'shared') return;
    await scope.tx
      .update(schema.commitment)
      .set({ visibility: 'shared', updatedAt: currentTime() })
      .where(eq(schema.commitment.id, commitmentId));
  }

  /** KI-17: neues Datum aus dem Termin; nach der Freigabe nicht (JBP-06, Inhalt gesperrt). */
  async moveFromMeeting(scope: JbpScope, commitmentId: string, dueOn: string) {
    const before = await this.own(scope, commitmentId);
    const plan = await currentPlan(scope.tx, scope.relationshipId);
    if (plan?.status === 'approved') {
      throw new ConflictException({ statusCode: 409, code: 'plan_freigegeben' });
    }
    return this.change(scope, before, { dueOn });
  }

  /** Nur die zusagende Seite ändert ihre Zusage (owner_org_id). */
  private async own(scope: JbpScope, commitmentId: string) {
    if (!this.canEdit(scope)) throw forbidden();
    const [row] = await scope.tx
      .select()
      .from(schema.commitment)
      .where(
        and(
          eq(schema.commitment.id, commitmentId),
          eq(schema.commitment.relationshipId, scope.relationshipId),
        ),
      );
    if (!row) throw notFound();
    if (row.ownerOrgId !== scope.orgId) throw forbidden();
    return row;
  }

  private async change(scope: JbpScope, before: CommitmentRow, next: Partial<CommitmentRow>) {
    const { tx } = scope;
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    const beforeTitle = await this.titleOf(tx, before.initiativeId);
    const after = { ...before, ...next };
    const afterTitle = await this.titleOf(tx, after.initiativeId);
    await auditedChange(tx, actor, commitmentAudit, async () => {
      await tx
        .update(schema.commitment)
        .set({ ...next, updatedAt: currentTime() })
        .where(eq(schema.commitment.id, before.id));
      return {
        objectId: before.id,
        relationshipId: scope.relationshipId,
        action: 'updated' as const,
        before: snapshot(before, beforeTitle),
        after: snapshot(after, afterTitle),
        result: undefined,
      };
    });
    return this.list(scope);
  }

  async update(scope: JbpScope, commitmentId: string, input: SaveCommitment) {
    const before = await this.own(scope, commitmentId);
    const { owner } = await this.prepare(scope, input);
    return this.change(scope, before, {
      title: input.title,
      ownerUserId: owner.userId,
      ownerName: owner.name,
      dueOn: input.dueOn,
      initiativeId: input.initiativeId,
    });
  }

  async setStatus(scope: JbpScope, commitmentId: string, status: CommitmentStatus) {
    const before = await this.own(scope, commitmentId);
    return this.change(scope, before, { status });
  }

  /**
   * Start (JBP-05): offene Zusagen der Person und offene Meilensteine der Initiativen, für die sie
   * auf ihrer Seite verantwortlich ist.
   */
  async dueItems(auth: AuthContext): Promise<DueItem[]> {
    const items: DueItem[] = [];
    await this.actions.eachRelationship(
      auth,
      async (tx, entry) => {
        const commitments = await tx
          .select({
            id: schema.commitment.id,
            title: schema.commitment.title,
            dueOn: schema.commitment.dueOn,
          })
          .from(schema.commitment)
          .where(
            and(
              eq(schema.commitment.relationshipId, entry.relationshipId),
              eq(schema.commitment.ownerUserId, auth.userId),
              eq(schema.commitment.status, 'open'),
            ),
          );
        for (const row of commitments) {
          items.push({
            id: row.id,
            kind: 'commitment',
            supplier: entry.counterpart,
            detail: row.title,
            dueDate: row.dueOn,
            href: `${entry.base}/plan/zusagen#${row.id}`,
          });
        }
        const milestones = await tx
          .select({
            id: schema.initiativeMilestone.id,
            title: schema.initiativeMilestone.title,
            dueOn: schema.initiativeMilestone.dueOn,
            initiativeId: schema.initiative.id,
          })
          .from(schema.initiativeMilestone)
          .innerJoin(
            schema.initiative,
            eq(schema.initiative.id, schema.initiativeMilestone.initiativeId),
          )
          .where(
            and(
              eq(schema.initiative.relationshipId, entry.relationshipId),
              sql`${schema.initiativeMilestone.doneOn} is null`,
              inArray(schema.initiative.status, ['planned', 'running']),
              or(
                eq(schema.initiative.ownerBuyerUserId, auth.userId),
                eq(schema.initiative.ownerSupplierUserId, auth.userId),
              ),
            ),
          );
        for (const row of milestones) {
          items.push({
            id: row.id,
            kind: 'milestone',
            supplier: entry.counterpart,
            detail: row.title,
            dueDate: row.dueOn,
            href: `${entry.base}/plan/initiativen/${row.initiativeId}`,
          });
        }
      },
      'jbp.sehen',
    );
    return items;
  }
}
