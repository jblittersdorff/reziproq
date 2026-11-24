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
  currentTime,
  desc,
  eq,
  inArray,
  schema,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type ImportJbpTopics,
  type JbpTopicCandidates,
  type JbpTopics,
  jbpTopicCandidatesSchema,
  jbpTopicsSchema,
  type SaveJbpTopic,
} from '@reziproq/shared';
import { actorOf } from '../audit/actor.js';
import { jbpTopicAudit } from '../audit/audited-objects.js';
import { can } from '../auth/can.js';
import type { JbpScope } from './jbp.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

type TopicRow = typeof schema.jbpTopic.$inferSelect;

/** Der jüngste Gemeinsame Plan der Beziehung, wie die Session ihn sieht. */
async function currentPlan(tx: TenantTransaction, relationshipId: string) {
  const [row] = await tx
    .select({ id: schema.jbp.id, status: schema.jbp.status })
    .from(schema.jbp)
    .where(eq(schema.jbp.relationshipId, relationshipId))
    .orderBy(desc(schema.jbp.version))
    .limit(1);
  return row ?? null;
}

/**
 * JBP-02: Themen beider Seiten im Gemeinsamen Plan. Jede Seite legt an, ordnet, ändert und parkt
 * nur ihre eigenen Themen (PLT-04). Der SRO übernimmt interne Themen des Lieferantenplans: Im Plan
 * stehen nur Titel und eine teilbare Beschreibung, die Herkunft bleibt käuferprivat.
 */
@Injectable()
export class JbpTopicsService {
  canEditOwn(scope: JbpScope) {
    if (!can(scope.auth, 'jbp.bearbeiten', { teamRole: scope.teamRole })) return false;
    return scope.side === 'supplier' || scope.auth.orgRole === 'admin' || scope.teamRole !== null;
  }

  canImport(scope: JbpScope) {
    return (
      scope.side === 'buyer' &&
      can(scope.auth, 'jbp.anlegen', { teamRole: scope.teamRole }) &&
      (scope.auth.orgRole === 'admin' || scope.teamRole === 'sro')
    );
  }

  async topics(scope: JbpScope): Promise<JbpTopics> {
    const { tx } = scope;
    const plan = await currentPlan(tx, scope.relationshipId);
    const rows = plan
      ? await tx
          .select()
          .from(schema.jbpTopic)
          .where(eq(schema.jbpTopic.jbpId, plan.id))
          .orderBy(asc(schema.jbpTopic.priority), asc(schema.jbpTopic.createdAt))
      : [];
    // Herkunft nur beim Käufer; für den Lieferanten lässt Row-Level Security keine Zeile durch.
    const origins =
      scope.side === 'buyer' && rows.length > 0
        ? await tx
            .select({
              topicId: schema.jbpTopicOrigin.jbpTopicId,
              title: schema.strategicTopic.title,
            })
            .from(schema.jbpTopicOrigin)
            .innerJoin(
              schema.strategicTopic,
              eq(schema.strategicTopic.id, schema.jbpTopicOrigin.strategicTopicId),
            )
            .where(
              inArray(
                schema.jbpTopicOrigin.jbpTopicId,
                rows.map((row) => row.id),
              ),
            )
        : [];
    const toTopic = (row: TopicRow) => {
      const origin = origins.find((entry) => entry.topicId === row.id);
      return {
        id: row.id,
        side: row.side,
        own: row.ownerOrgId === scope.orgId,
        title: row.title,
        description: row.description,
        priority: row.priority,
        status: row.status,
        parkReason: row.parkReason,
        origin: origin ? { title: origin.title } : null,
      };
    };
    return jbpTopicsSchema.parse({
      hasPlan: Boolean(plan),
      ownSide: scope.side,
      buyer: rows.filter((row) => row.side === 'buyer').map(toTopic),
      supplier: rows.filter((row) => row.side === 'supplier').map(toTopic),
      canEditOwn: Boolean(plan) && this.canEditOwn(scope),
      canImport: Boolean(plan) && this.canImport(scope),
    });
  }

  /** Interne Themen des jüngsten Lieferantenplans im aktiven Zyklus, die noch nicht übernommen sind. */
  async candidates(scope: JbpScope): Promise<JbpTopicCandidates> {
    if (!this.canImport(scope)) throw forbidden();
    const { tx } = scope;
    const [plan] = await tx
      .select({ id: schema.supplierPlan.id })
      .from(schema.supplierPlan)
      .innerJoin(schema.cycle, eq(schema.cycle.id, schema.supplierPlan.cycleId))
      .where(
        and(
          eq(schema.supplierPlan.relationshipId, scope.relationshipId),
          eq(schema.cycle.status, 'active'),
        ),
      )
      .orderBy(desc(schema.supplierPlan.version))
      .limit(1);
    if (!plan) return jbpTopicCandidatesSchema.parse({ candidates: [] });
    const topics = await tx
      .select({
        id: schema.strategicTopic.id,
        title: schema.strategicTopic.title,
        reason: schema.strategicTopic.reason,
      })
      .from(schema.strategicTopic)
      .where(eq(schema.strategicTopic.planId, plan.id))
      .orderBy(asc(schema.strategicTopic.priority));
    const taken = await tx
      .select({ id: schema.jbpTopicOrigin.strategicTopicId })
      .from(schema.jbpTopicOrigin)
      .where(eq(schema.jbpTopicOrigin.relationshipId, scope.relationshipId));
    const takenIds = new Set(taken.map((row) => row.id));
    return jbpTopicCandidatesSchema.parse({
      candidates: topics.filter((topic) => !takenIds.has(topic.id)),
    });
  }

  private async requirePlan(scope: JbpScope) {
    const plan = await currentPlan(scope.tx, scope.relationshipId);
    if (!plan) throw notFound();
    // JBP-06: Nach der Freigabe ändern sich Themen nur über eine neue Version.
    if (plan.status === 'approved') {
      throw new ConflictException({ statusCode: 409, code: 'plan_freigegeben' });
    }
    return plan;
  }

  private async nextPriority(scope: JbpScope, jbpId: string) {
    const rows = await scope.tx
      .select({ priority: schema.jbpTopic.priority })
      .from(schema.jbpTopic)
      .where(and(eq(schema.jbpTopic.jbpId, jbpId), eq(schema.jbpTopic.ownerOrgId, scope.orgId)));
    return Math.max(0, ...rows.map((row) => row.priority)) + 1;
  }

  private async creator(scope: JbpScope) {
    const [user] = await scope.tx
      .select({ name: schema.appUser.name })
      .from(schema.appUser)
      .where(eq(schema.appUser.id, scope.auth.userId));
    return { createdBy: scope.auth.userId, createdByName: user?.name ?? '' };
  }

  private snapshot(row: Pick<TopicRow, 'title' | 'description' | 'status' | 'priority'>) {
    return {
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
    };
  }

  async create(scope: JbpScope, input: SaveJbpTopic): Promise<JbpTopics> {
    if (!this.canEditOwn(scope)) throw forbidden();
    const plan = await this.requirePlan(scope);
    const { tx } = scope;
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    const priority = await this.nextPriority(scope, plan.id);
    const creator = await this.creator(scope);
    await auditedChange(tx, actor, jbpTopicAudit, async () => {
      const [row] = await tx
        .insert(schema.jbpTopic)
        .values({
          relationshipId: scope.relationshipId,
          ownerOrgId: scope.orgId,
          visibility: 'shared',
          jbpId: plan.id,
          side: scope.side,
          title: input.title,
          description: input.description,
          priority,
          ...creator,
        })
        .returning();
      const created = row as TopicRow;
      return {
        objectId: created.id,
        relationshipId: scope.relationshipId,
        action: 'created' as const,
        after: this.snapshot(created),
        result: undefined,
      };
    });
    return this.topics(scope);
  }

  /**
   * Aus dem Lieferantenplan übernehmen: Titel aus dem internen Thema, Beschreibung vom SRO. Die
   * Begründung wird nicht kopiert; der Verweis steht käuferprivat in jbp_topic_origin.
   */
  async importTopics(scope: JbpScope, input: ImportJbpTopics): Promise<JbpTopics> {
    if (!this.canImport(scope)) throw forbidden();
    const plan = await this.requirePlan(scope);
    const { tx } = scope;
    const available = new Map(
      (await this.candidates(scope)).candidates.map((entry) => [entry.id, entry]),
    );
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    const creator = await this.creator(scope);
    let priority = await this.nextPriority(scope, plan.id);
    for (const item of input.items) {
      const source = available.get(item.strategicTopicId);
      if (!source) throw new BadRequestException({ statusCode: 400, code: 'thema_unbekannt' });
      await auditedChange(tx, actor, jbpTopicAudit, async () => {
        const [row] = await tx
          .insert(schema.jbpTopic)
          .values({
            relationshipId: scope.relationshipId,
            ownerOrgId: scope.orgId,
            visibility: 'shared',
            jbpId: plan.id,
            side: 'buyer',
            title: source.title,
            description: item.description,
            priority,
            ...creator,
          })
          .returning();
        const created = row as TopicRow;
        await tx.insert(schema.jbpTopicOrigin).values({
          relationshipId: scope.relationshipId,
          jbpTopicId: created.id,
          strategicTopicId: source.id,
        });
        priority += 1;
        return {
          objectId: created.id,
          relationshipId: scope.relationshipId,
          action: 'created' as const,
          after: this.snapshot(created),
          result: undefined,
        };
      });
    }
    return this.topics(scope);
  }

  private async own(scope: JbpScope, topicId: string) {
    if (!this.canEditOwn(scope)) throw forbidden();
    const [row] = await scope.tx
      .select()
      .from(schema.jbpTopic)
      .where(
        and(
          eq(schema.jbpTopic.id, topicId),
          eq(schema.jbpTopic.relationshipId, scope.relationshipId),
        ),
      );
    if (!row) throw notFound();
    if (row.ownerOrgId !== scope.orgId) throw forbidden();
    await this.requirePlan(scope);
    return row;
  }

  private async change(scope: JbpScope, before: TopicRow, next: Partial<TopicRow>) {
    const { tx } = scope;
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    await auditedChange(tx, actor, jbpTopicAudit, async () => {
      await tx
        .update(schema.jbpTopic)
        .set({ ...next, updatedAt: currentTime() })
        .where(eq(schema.jbpTopic.id, before.id));
      return {
        objectId: before.id,
        relationshipId: scope.relationshipId,
        action: 'updated' as const,
        before: this.snapshot(before),
        after: this.snapshot({ ...before, ...next }),
        result: undefined,
      };
    });
    return this.topics(scope);
  }

  async update(scope: JbpScope, topicId: string, input: SaveJbpTopic) {
    const before = await this.own(scope, topicId);
    return this.change(scope, before, { title: input.title, description: input.description });
  }

  /** Parken mit Begründung; geparkte Themen bleiben mit Begründung sichtbar. */
  async park(scope: JbpScope, topicId: string, reason: string) {
    const before = await this.own(scope, topicId);
    return this.change(scope, before, { status: 'parked', parkReason: reason });
  }

  async restore(scope: JbpScope, topicId: string) {
    const before = await this.own(scope, topicId);
    return this.change(scope, before, { status: 'proposed', parkReason: null });
  }

  /** Eigene Themen ordnen: die ganze Reihenfolge der eigenen Seite. */
  async reorder(scope: JbpScope, ids: string[]) {
    if (!this.canEditOwn(scope)) throw forbidden();
    const plan = await this.requirePlan(scope);
    const { tx } = scope;
    const own = await tx
      .select()
      .from(schema.jbpTopic)
      .where(and(eq(schema.jbpTopic.jbpId, plan.id), eq(schema.jbpTopic.ownerOrgId, scope.orgId)));
    const ownIds = new Set(own.map((row) => row.id));
    if (ids.length !== own.length || ids.some((id) => !ownIds.has(id))) {
      throw new BadRequestException({ statusCode: 400, code: 'reihenfolge_unvollstaendig' });
    }
    for (const [index, id] of ids.entries()) {
      await tx
        .update(schema.jbpTopic)
        .set({ priority: index + 1, updatedAt: currentTime() })
        .where(eq(schema.jbpTopic.id, id));
    }
    return this.topics(scope);
  }
}
