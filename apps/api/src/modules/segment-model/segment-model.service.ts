import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import type {
  SegmentAxis,
  SegmentModel,
  SegmentModelResponse,
  UpdateSegmentBoundaries,
  UpdateSegmentCriterion,
  UpdateSegmentType,
  UpdateSegmentWeights,
} from '@reziproq/shared';
import { segmentModelResponseSchema } from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';

const notFound = () =>
  new NotFoundException({ statusCode: 404, code: 'nicht_gefunden', message: 'Nicht gefunden.' });

const invalidWeights = () =>
  new BadRequestException({
    statusCode: 400,
    code: 'weight_sum',
    message: 'Die Gewichte jeder Achse müssen zusammen 100 ergeben.',
  });

function translate(error: unknown): never {
  const cause = (error as { cause?: { code?: string; message?: string } }).cause;
  if (cause?.message?.startsWith('segment_weights_invalid:')) throw invalidWeights();
  if (cause?.code === '23505') {
    throw new ConflictException({
      statusCode: 409,
      code: 'draft_conflict',
      message: 'Das Segmentmodell wurde gleichzeitig geändert. Lade die Seite neu.',
    });
  }
  throw error;
}

@Injectable()
export class SegmentModelService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private organization(auth: AuthContext): AccountOrganization {
    const organization = auth.organization;
    if (!organization?.buyer) {
      throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
    }
    return organization;
  }

  private run<T>(
    auth: AuthContext,
    work: (tx: TenantTransaction, organization: AccountOrganization) => Promise<T>,
  ): Promise<T> {
    const organization = this.organization(auth);
    return this.tenant
      .run({ userId: auth.userId, organizationId: organization.id }, (tx) => work(tx, organization))
      .catch(translate);
  }

  get(auth: AuthContext): Promise<SegmentModelResponse> {
    return this.run(auth, async (tx, organization) => {
      const models = await tx
        .select()
        .from(schema.segmentModel)
        .where(eq(schema.segmentModel.orgId, organization.id));
      const active = models.find((model) => model.status === 'active');
      const draft = models.find((model) => model.status === 'draft');
      return segmentModelResponseSchema.parse({
        active: active ? await this.model(tx, active.id) : null,
        draft: draft ? await this.model(tx, draft.id) : null,
      });
    });
  }

  async createDraft(auth: AuthContext): Promise<SegmentModelResponse> {
    await this.run(auth, async (tx, organization) => {
      await this.ensureDraft(tx, organization.id);
    });
    return this.get(auth);
  }

  async updateCriterion(
    auth: AuthContext,
    key: string,
    input: UpdateSegmentCriterion,
  ): Promise<SegmentModelResponse> {
    await this.run(auth, async (tx, organization) => {
      const modelId = await this.ensureDraft(tx, organization.id);
      const rows = await tx
        .update(schema.segmentCriterion)
        .set({ name: input.name, description: input.description })
        .where(
          and(eq(schema.segmentCriterion.modelId, modelId), eq(schema.segmentCriterion.key, key)),
        )
        .returning({ key: schema.segmentCriterion.key });
      if (!rows.length) throw notFound();
    });
    return this.get(auth);
  }

  async updateWeights(
    auth: AuthContext,
    input: UpdateSegmentWeights,
  ): Promise<SegmentModelResponse> {
    await this.run(auth, async (tx, organization) => {
      const modelId = await this.ensureDraft(tx, organization.id);
      const criteria = await tx
        .select({ key: schema.segmentCriterion.key, axis: schema.segmentCriterion.axis })
        .from(schema.segmentCriterion)
        .where(eq(schema.segmentCriterion.modelId, modelId));

      for (const axis of ['impact', 'quality'] as const satisfies readonly SegmentAxis[]) {
        const expected = criteria
          .filter((criterion) => criterion.axis === axis)
          .map((criterion) => criterion.key)
          .sort();
        const submitted = input[axis].map((entry) => entry.key).sort();
        if (
          expected.length !== submitted.length ||
          expected.some((key, index) => key !== submitted[index])
        ) {
          throw invalidWeights();
        }
        for (const entry of input[axis]) {
          await tx
            .update(schema.segmentCriterion)
            .set({ weight: entry.weight })
            .where(
              and(
                eq(schema.segmentCriterion.modelId, modelId),
                eq(schema.segmentCriterion.key, entry.key),
              ),
            );
        }
      }
    });
    return this.get(auth);
  }

  async updateBoundaries(
    auth: AuthContext,
    input: UpdateSegmentBoundaries,
  ): Promise<SegmentModelResponse> {
    await this.run(auth, async (tx, organization) => {
      const modelId = await this.ensureDraft(tx, organization.id);
      await tx
        .update(schema.segmentModel)
        .set({
          lowMax: input.lowMax,
          midMax: input.midMax,
          ...(input.deviationThreshold !== undefined && {
            deviationThreshold: input.deviationThreshold,
          }),
          ...(input.focusSpendShare !== undefined && { focusSpendShare: input.focusSpendShare }),
        })
        .where(eq(schema.segmentModel.id, modelId));
    });
    return this.get(auth);
  }

  async updateType(
    auth: AuthContext,
    impactLevel: number,
    qualityLevel: number,
    input: UpdateSegmentType,
  ): Promise<SegmentModelResponse> {
    if (![1, 2, 3].includes(impactLevel) || ![1, 2, 3].includes(qualityLevel)) {
      throw notFound();
    }
    await this.run(auth, async (tx, organization) => {
      const modelId = await this.ensureDraft(tx, organization.id);
      const rows = await tx
        .update(schema.segmentType)
        .set({ name: input.name, description: input.description })
        .where(
          and(
            eq(schema.segmentType.modelId, modelId),
            eq(schema.segmentType.impactLevel, impactLevel),
            eq(schema.segmentType.qualityLevel, qualityLevel),
          ),
        )
        .returning({ impactLevel: schema.segmentType.impactLevel });
      if (!rows.length) throw notFound();
    });
    return this.get(auth);
  }

  async activateDraft(auth: AuthContext): Promise<SegmentModelResponse> {
    await this.run(auth, async (tx, organization) => {
      const models = await tx
        .select()
        .from(schema.segmentModel)
        .where(eq(schema.segmentModel.orgId, organization.id));
      const draft = models.find((model) => model.status === 'draft');
      if (!draft) throw notFound();

      const complete = await this.model(tx, draft.id);
      if (
        complete.criteria.filter((criterion) => criterion.axis === 'impact').length === 0 ||
        complete.criteria.filter((criterion) => criterion.axis === 'quality').length === 0 ||
        complete.types.length !== 9
      ) {
        throw new ConflictException({
          statusCode: 409,
          code: 'incomplete_model',
          message: 'Das Segmentmodell braucht Kriterien auf beiden Achsen und alle neun Typen.',
        });
      }

      await tx
        .update(schema.segmentModel)
        .set({ status: 'retired' })
        .where(
          and(
            eq(schema.segmentModel.orgId, organization.id),
            eq(schema.segmentModel.status, 'active'),
          ),
        );
      await tx
        .update(schema.segmentModel)
        .set({ status: 'active', activatedAt: new Date() })
        .where(eq(schema.segmentModel.id, draft.id));
    });
    return this.get(auth);
  }

  private async ensureDraft(tx: TenantTransaction, orgId: string): Promise<string> {
    await tx.execute(sql`
      select id from segment_model
      where org_id = ${orgId} and status = 'active'
      for update
    `);
    const models = await tx
      .select()
      .from(schema.segmentModel)
      .where(eq(schema.segmentModel.orgId, orgId));
    const draft = models.find((model) => model.status === 'draft');
    if (draft) return draft.id;

    const active = models.find((model) => model.status === 'active');
    if (!active) {
      throw new ConflictException({
        statusCode: 409,
        code: 'model_missing',
        message: 'Für diese Organisation gibt es noch kein aktives Segmentmodell.',
      });
    }
    const [created] = await tx
      .insert(schema.segmentModel)
      .values({
        orgId,
        version: active.version + 1,
        status: 'draft',
        lowMax: active.lowMax,
        midMax: active.midMax,
        deviationThreshold: active.deviationThreshold,
        focusSpendShare: active.focusSpendShare,
      })
      .returning({ id: schema.segmentModel.id });
    if (!created) throw new Error('Der Segmentmodell-Entwurf konnte nicht angelegt werden.');

    const criteria = await tx
      .select()
      .from(schema.segmentCriterion)
      .where(eq(schema.segmentCriterion.modelId, active.id));
    const types = await tx
      .select()
      .from(schema.segmentType)
      .where(eq(schema.segmentType.modelId, active.id));
    await tx.insert(schema.segmentCriterion).values(
      criteria.map(({ modelId: _modelId, ...criterion }) => ({
        ...criterion,
        modelId: created.id,
      })),
    );
    await tx
      .insert(schema.segmentType)
      .values(types.map(({ modelId: _modelId, ...type }) => ({ ...type, modelId: created.id })));
    return created.id;
  }

  private async model(tx: TenantTransaction, id: string): Promise<SegmentModel> {
    const [row] = await tx.select().from(schema.segmentModel).where(eq(schema.segmentModel.id, id));
    if (!row) throw notFound();
    const criteria = await tx
      .select()
      .from(schema.segmentCriterion)
      .where(eq(schema.segmentCriterion.modelId, id))
      .orderBy(asc(schema.segmentCriterion.axis), asc(schema.segmentCriterion.position));
    const types = await tx
      .select()
      .from(schema.segmentType)
      .where(eq(schema.segmentType.modelId, id))
      .orderBy(asc(schema.segmentType.impactLevel), asc(schema.segmentType.qualityLevel));

    return {
      id: row.id,
      version: row.version,
      status: row.status,
      lowMax: row.lowMax,
      midMax: row.midMax,
      deviationThreshold: row.deviationThreshold,
      focusSpendShare: row.focusSpendShare,
      createdAt: row.createdAt.toISOString(),
      activatedAt: row.activatedAt?.toISOString() ?? null,
      criteria,
      types,
    };
  }
}
