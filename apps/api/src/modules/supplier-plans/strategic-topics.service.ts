import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, auditedChange, eq, inArray, schema, type TenantTransaction } from '@reziproq/db';
import type { StrategicTopicOrder, StrategicTopicRequest } from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { strategicTopicAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { ownRelationship } from '../suppliers/team.service.js';
import { SupplierPlansService } from './supplier-plans.service.js';

const notFound = () =>
  new NotFoundException({ statusCode: 404, code: 'nicht_gefunden', message: 'Nicht gefunden.' });

/** Strategische Themen im Lieferantenplan (SPL-06). Nur Käuferseite; Ändern nur SRO und Admin. */
@Injectable()
export class StrategicTopicsService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(SupplierPlansService) private readonly plans: SupplierPlansService,
  ) {}

  private async prepare(
    tx: TenantTransaction,
    auth: AuthContext,
    organization: ReturnType<SupplierPlansService['organization']>,
    relationshipId: string,
    planId: string,
  ) {
    await ownRelationship(tx, organization, relationshipId);
    await this.plans.draftPlan(tx, relationshipId, planId);
    const permissions = await this.plans.relationshipPermissions(
      tx,
      auth,
      organization.id,
      relationshipId,
    );
    if (!permissions.canManage)
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
  }

  private async requireObjectives(
    tx: TenantTransaction,
    relationshipId: string,
    planId: string,
    objectiveIds: string[],
  ) {
    const unique = [...new Set(objectiveIds)];
    const found = await tx
      .select({ id: schema.planObjective.id })
      .from(schema.planObjective)
      .where(
        and(
          eq(schema.planObjective.planId, planId),
          eq(schema.planObjective.relationshipId, relationshipId),
          inArray(schema.planObjective.id, unique),
        ),
      );
    if (found.length !== unique.length) {
      throw new ConflictException({
        statusCode: 409,
        code: 'invalid_objective',
        message: 'Ein Ziel gehört nicht zu diesem Plan.',
      });
    }
    return unique.sort();
  }

  async create(
    auth: AuthContext,
    relationshipId: string,
    planId: string,
    input: StrategicTopicRequest,
  ) {
    const organization = this.plans.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await this.prepare(tx, auth, organization, relationshipId, planId);
      const objectiveIds = await this.requireObjectives(
        tx,
        relationshipId,
        planId,
        input.objectiveIds,
      );
      const existing = await tx
        .select({ id: schema.strategicTopic.id })
        .from(schema.strategicTopic)
        .where(eq(schema.strategicTopic.planId, planId));
      const priority = existing.length + 1;
      const actor = await actorOf(tx, auth, organization.id);
      const id = await auditedChange(tx, actor, strategicTopicAudit, async () => {
        const [created] = await tx
          .insert(schema.strategicTopic)
          .values({ relationshipId, planId, title: input.title, reason: input.reason, priority })
          .returning({ id: schema.strategicTopic.id });
        if (!created) throw new Error('Thema konnte nicht angelegt werden');
        await tx.insert(schema.strategicTopicObjective).values(
          objectiveIds.map((objectiveId) => ({
            relationshipId,
            topicId: created.id,
            objectiveId,
          })),
        );
        return {
          objectId: created.id,
          relationshipId,
          action: 'created',
          after: {
            title: input.title,
            reason: input.reason,
            priority,
            objective_ids: objectiveIds.join(','),
          },
          result: created.id,
        };
      });
      return { id };
    });
  }

  async update(
    auth: AuthContext,
    relationshipId: string,
    planId: string,
    topicId: string,
    input: StrategicTopicRequest,
  ) {
    const organization = this.plans.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await this.prepare(tx, auth, organization, relationshipId, planId);
      const [before] = await tx
        .select()
        .from(schema.strategicTopic)
        .where(
          and(
            eq(schema.strategicTopic.id, topicId),
            eq(schema.strategicTopic.planId, planId),
            eq(schema.strategicTopic.relationshipId, relationshipId),
          ),
        );
      if (!before) throw notFound();
      const objectiveIds = await this.requireObjectives(
        tx,
        relationshipId,
        planId,
        input.objectiveIds,
      );
      const beforeLinks = await tx
        .select({ id: schema.strategicTopicObjective.objectiveId })
        .from(schema.strategicTopicObjective)
        .where(eq(schema.strategicTopicObjective.topicId, topicId));
      const actor = await actorOf(tx, auth, organization.id);
      return auditedChange(tx, actor, strategicTopicAudit, async () => {
        await tx
          .update(schema.strategicTopic)
          .set({ title: input.title, reason: input.reason })
          .where(eq(schema.strategicTopic.id, topicId));
        await tx
          .delete(schema.strategicTopicObjective)
          .where(eq(schema.strategicTopicObjective.topicId, topicId));
        await tx
          .insert(schema.strategicTopicObjective)
          .values(objectiveIds.map((objectiveId) => ({ relationshipId, topicId, objectiveId })));
        return {
          objectId: topicId,
          relationshipId,
          action: 'updated',
          before: {
            title: before.title,
            reason: before.reason,
            priority: before.priority,
            objective_ids: beforeLinks
              .map((link) => link.id)
              .sort()
              .join(','),
          },
          after: {
            title: input.title,
            reason: input.reason,
            priority: before.priority,
            objective_ids: objectiveIds.join(','),
          },
          result: { id: topicId },
        };
      });
    });
  }

  async reorder(
    auth: AuthContext,
    relationshipId: string,
    planId: string,
    input: StrategicTopicOrder,
  ) {
    const organization = this.plans.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      await this.prepare(tx, auth, organization, relationshipId, planId);
      const topics = await tx
        .select()
        .from(schema.strategicTopic)
        .where(
          and(
            eq(schema.strategicTopic.planId, planId),
            eq(schema.strategicTopic.relationshipId, relationshipId),
          ),
        );
      const known = new Set(topics.map((topic) => topic.id));
      if (
        input.topicIds.length !== known.size ||
        new Set(input.topicIds).size !== known.size ||
        input.topicIds.some((id) => !known.has(id))
      ) {
        throw new ConflictException({
          statusCode: 409,
          code: 'invalid_order',
          message: 'Die Reihenfolge muss alle Themen genau einmal enthalten.',
        });
      }
      const actor = await actorOf(tx, auth, organization.id);
      const byId = new Map(topics.map((topic) => [topic.id, topic]));
      for (const [index, id] of input.topicIds.entries()) {
        const topic = byId.get(id);
        if (!topic || topic.priority === index + 1) continue;
        await auditedChange(tx, actor, strategicTopicAudit, async () => {
          await tx
            .update(schema.strategicTopic)
            .set({ priority: index + 1 })
            .where(eq(schema.strategicTopic.id, id));
          return {
            objectId: id,
            relationshipId,
            action: 'updated',
            before: { priority: topic.priority },
            after: { priority: index + 1 },
            result: null,
          };
        });
      }
      return { ok: true };
    });
  }
}
