import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type Initiative,
  type InitiativeDetail,
  type InitiativeStatus,
  type Initiatives,
  initiativeDetailSchema,
  initiativesSchema,
  type SaveInitiative,
  type SaveMilestone,
} from '@reziproq/shared';
import { actorOf } from '../audit/actor.js';
import { initiativeAudit } from '../audit/audited-objects.js';
import { can } from '../auth/can.js';
import type { JbpScope } from './jbp.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const approvedConflict = () => new ConflictException({ statusCode: 409, code: 'plan_freigegeben' });

type InitiativeRow = typeof schema.initiative.$inferSelect;
type MilestoneRow = typeof schema.initiativeMilestone.$inferSelect;

/** Meilensteine als eine lesbare Zeile im Verlauf, z. B. „Muster 2027-03-15 ✓“. */
const milestoneText = (rows: Pick<MilestoneRow, 'title' | 'dueOn' | 'doneOn'>[]) =>
  [...rows]
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
    .map((row) => `${row.title} ${row.dueOn}${row.doneOn ? ' ✓' : ''}`)
    .join('; ');

const snapshot = (row: InitiativeRow, milestones: MilestoneRow[]) => ({
  title: row.title,
  goal: row.goal,
  benefit_buyer: row.benefitBuyer,
  benefit_supplier: row.benefitSupplier,
  owner_buyer_name: row.ownerBuyerName,
  owner_supplier_name: row.ownerSupplierName,
  starts_on: row.startsOn,
  ends_on: row.endsOn,
  status: row.status,
  milestones: milestoneText(milestones),
});

/**
 * JBP-03: Gemeinsame Initiativen beider Seiten. Jede Zeile gehört der Seite, die sie angelegt hat;
 * Änderungen laufen für beide Seiten über die Funktionen app_initiative_* (Migration 0046). Nach
 * der Freigabe des Plans (JBP-06) sind nur Status und Meilensteine änderbar. Jede Änderung steht
 * im geteilten Verlauf.
 */
@Injectable()
export class JbpInitiativesService {
  canEdit(scope: JbpScope) {
    if (!can(scope.auth, 'jbp.bearbeiten', { teamRole: scope.teamRole })) return false;
    return scope.side === 'supplier' || scope.auth.orgRole === 'admin' || scope.teamRole !== null;
  }

  private async plan(tx: TenantTransaction, relationshipId: string) {
    const [row] = await tx
      .select({ id: schema.jbp.id, status: schema.jbp.status })
      .from(schema.jbp)
      .where(eq(schema.jbp.relationshipId, relationshipId))
      .orderBy(desc(schema.jbp.version))
      .limit(1);
    return row ?? null;
  }

  private async load(tx: TenantTransaction, rows: InitiativeRow[]): Promise<Initiative[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((row) => row.id);
    const milestones = await tx
      .select()
      .from(schema.initiativeMilestone)
      .where(inArray(schema.initiativeMilestone.initiativeId, ids))
      .orderBy(asc(schema.initiativeMilestone.dueOn), asc(schema.initiativeMilestone.id));
    const topics = await tx
      .select({
        initiativeId: schema.initiativeTopic.initiativeId,
        id: schema.jbpTopic.id,
        title: schema.jbpTopic.title,
        side: schema.jbpTopic.side,
      })
      .from(schema.initiativeTopic)
      .innerJoin(schema.jbpTopic, eq(schema.jbpTopic.id, schema.initiativeTopic.jbpTopicId))
      .where(inArray(schema.initiativeTopic.initiativeId, ids))
      .orderBy(asc(schema.jbpTopic.side), asc(schema.jbpTopic.priority));
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      goal: row.goal,
      benefitBuyer: row.benefitBuyer,
      benefitSupplier: row.benefitSupplier,
      ownerBuyerName: row.ownerBuyerName,
      ownerSupplierName: row.ownerSupplierName,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      status: row.status,
      milestones: milestones
        .filter((milestone) => milestone.initiativeId === row.id)
        .map(({ id, title, dueOn, doneOn }) => ({ id, title, dueOn, doneOn })),
      topics: topics
        .filter((topic) => topic.initiativeId === row.id)
        .map(({ id, title, side }) => ({ id, title, side })),
    }));
  }

  async list(scope: JbpScope): Promise<Initiatives> {
    const { tx } = scope;
    const plan = await this.plan(tx, scope.relationshipId);
    const rows = plan
      ? await tx
          .select()
          .from(schema.initiative)
          .where(eq(schema.initiative.jbpId, plan.id))
          .orderBy(asc(schema.initiative.startsOn), asc(schema.initiative.createdAt))
      : [];
    return initiativesSchema.parse({
      hasPlan: Boolean(plan),
      approved: plan?.status === 'approved',
      canEdit: Boolean(plan) && this.canEdit(scope),
      initiatives: await this.load(tx, rows),
    });
  }

  private async row(scope: JbpScope, initiativeId: string) {
    const [row] = await scope.tx
      .select()
      .from(schema.initiative)
      .where(
        and(
          eq(schema.initiative.id, initiativeId),
          eq(schema.initiative.relationshipId, scope.relationshipId),
        ),
      );
    if (!row) throw notFound();
    const [plan] = await scope.tx
      .select({ status: schema.jbp.status })
      .from(schema.jbp)
      .where(eq(schema.jbp.id, row.jbpId));
    const milestones = await scope.tx
      .select()
      .from(schema.initiativeMilestone)
      .where(eq(schema.initiativeMilestone.initiativeId, row.id));
    return { row, milestones, approved: plan?.status === 'approved' };
  }

  async get(scope: JbpScope, initiativeId: string): Promise<InitiativeDetail> {
    const { row, approved } = await this.row(scope, initiativeId);
    const [initiative] = await this.load(scope.tx, [row]);
    return initiativeDetailSchema.parse({
      initiative,
      approved,
      canEdit: this.canEdit(scope),
    });
  }

  /** Verlauf: vorher und nachher als Schnappschuss, Meilensteine als eine Zeile. */
  private async audited(
    scope: JbpScope,
    initiativeId: string,
    action: 'created' | 'updated',
    write: () => Promise<void>,
  ) {
    const { tx } = scope;
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    const before = action === 'updated' ? await this.row(scope, initiativeId) : null;
    await auditedChange(tx, actor, initiativeAudit, async () => {
      await write();
      const after = await this.row(scope, initiativeId);
      return {
        objectId: initiativeId,
        relationshipId: scope.relationshipId,
        action,
        ...(before ? { before: snapshot(before.row, before.milestones) } : {}),
        after: snapshot(after.row, after.milestones),
        result: undefined,
      };
    });
  }

  /** Funktionsfehler der Datenbank in Antworten übersetzen. */
  private async call(run: () => Promise<unknown>) {
    try {
      await run();
    } catch (error) {
      const message = String((error as { cause?: { message?: string } }).cause?.message ?? error);
      if (message.includes('plan_approved')) throw approvedConflict();
      if (message.includes('not_found')) throw notFound();
      throw error;
    }
  }

  async create(scope: JbpScope, input: SaveInitiative): Promise<InitiativeDetail> {
    if (!this.canEdit(scope)) throw forbidden();
    const { tx } = scope;
    const plan = await this.plan(tx, scope.relationshipId);
    if (!plan) throw notFound();
    if (plan.status === 'approved') throw approvedConflict();
    const topicIds = [...new Set(input.topicIds ?? [])];
    if (topicIds.length > 0) {
      const topics = await tx
        .select({ id: schema.jbpTopic.id })
        .from(schema.jbpTopic)
        .where(
          and(
            inArray(schema.jbpTopic.id, topicIds),
            eq(schema.jbpTopic.jbpId, plan.id),
            eq(schema.jbpTopic.status, 'proposed'),
          ),
        );
      if (topics.length !== topicIds.length) {
        throw new BadRequestException({ statusCode: 400, code: 'thema_nicht_offen' });
      }
    }
    const [user] = await tx
      .select({ name: schema.appUser.name })
      .from(schema.appUser)
      .where(eq(schema.appUser.id, scope.auth.userId));
    const id = crypto.randomUUID();
    await this.audited(scope, id, 'created', async () => {
      await tx.insert(schema.initiative).values({
        id,
        relationshipId: scope.relationshipId,
        ownerOrgId: scope.orgId,
        visibility: 'shared',
        jbpId: plan.id,
        title: input.title,
        goal: input.goal,
        benefitBuyer: input.benefitBuyer,
        benefitSupplier: input.benefitSupplier,
        ownerBuyerName: input.ownerBuyerName,
        ownerSupplierName: input.ownerSupplierName,
        startsOn: input.startsOn,
        endsOn: input.endsOn,
        createdBy: scope.auth.userId,
        createdByName: user?.name ?? '',
      });
      // Zusammenführen: verknüpfen und die Themen beider Seiten auf merged setzen.
      for (const topicId of topicIds) {
        await tx.insert(schema.initiativeTopic).values({
          relationshipId: scope.relationshipId,
          ownerOrgId: scope.orgId,
          visibility: 'shared',
          initiativeId: id,
          jbpTopicId: topicId,
        });
        await this.call(() => tx.execute(sql`select app_jbp_topic_merge(${topicId})`));
      }
    });
    return this.get(scope, id);
  }

  private async editable(scope: JbpScope, initiativeId: string) {
    if (!this.canEdit(scope)) throw forbidden();
    return this.row(scope, initiativeId);
  }

  async update(scope: JbpScope, initiativeId: string, input: SaveInitiative) {
    const { approved } = await this.editable(scope, initiativeId);
    if (approved) throw approvedConflict();
    if (input.topicIds?.length) {
      throw new BadRequestException({ statusCode: 400, code: 'themen_nur_beim_anlegen' });
    }
    await this.audited(scope, initiativeId, 'updated', () =>
      this.call(() =>
        scope.tx.execute(
          sql`select app_initiative_save(${initiativeId}, ${input.title}, ${input.goal}, ${input.benefitBuyer}, ${input.benefitSupplier}, ${input.ownerBuyerName}, ${input.ownerSupplierName}, ${input.startsOn}::date, ${input.endsOn}::date)`,
        ),
      ),
    );
    return this.get(scope, initiativeId);
  }

  async setStatus(scope: JbpScope, initiativeId: string, status: InitiativeStatus) {
    await this.editable(scope, initiativeId);
    await this.audited(scope, initiativeId, 'updated', () =>
      this.call(() =>
        scope.tx.execute(sql`select app_initiative_status(${initiativeId}, ${status})`),
      ),
    );
    return this.get(scope, initiativeId);
  }

  async addMilestone(scope: JbpScope, initiativeId: string, input: SaveMilestone) {
    await this.editable(scope, initiativeId);
    await this.audited(scope, initiativeId, 'updated', async () => {
      await scope.tx.insert(schema.initiativeMilestone).values({
        relationshipId: scope.relationshipId,
        ownerOrgId: scope.orgId,
        visibility: 'shared',
        initiativeId,
        title: input.title,
        dueOn: input.dueOn,
        doneOn: input.doneOn,
      });
    });
    return this.get(scope, initiativeId);
  }

  private async milestone(scope: JbpScope, initiativeId: string, milestoneId: string) {
    const { milestones } = await this.editable(scope, initiativeId);
    if (!milestones.some((row) => row.id === milestoneId)) throw notFound();
  }

  async updateMilestone(
    scope: JbpScope,
    initiativeId: string,
    milestoneId: string,
    input: SaveMilestone,
  ) {
    await this.milestone(scope, initiativeId, milestoneId);
    await this.audited(scope, initiativeId, 'updated', () =>
      this.call(() =>
        scope.tx.execute(
          sql`select app_initiative_milestone_save(${milestoneId}, ${input.title}, ${input.dueOn}::date, ${input.doneOn}::date)`,
        ),
      ),
    );
    return this.get(scope, initiativeId);
  }

  async deleteMilestone(scope: JbpScope, initiativeId: string, milestoneId: string) {
    await this.milestone(scope, initiativeId, milestoneId);
    await this.audited(scope, initiativeId, 'updated', () =>
      this.call(() =>
        scope.tx.execute(sql`select app_initiative_milestone_delete(${milestoneId})`),
      ),
    );
    return this.get(scope, initiativeId);
  }
}
