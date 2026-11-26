import {
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  currentTime,
  eq,
  inArray,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  calculateSegment,
  type DueItem,
  type OverviewMetric,
  type RatingAssignment,
  type RatingAssignmentList,
  type RatingDetail,
  type RatingOutcome,
  ratingAssignmentListSchema,
  ratingDetailSchema,
  type SaveRating,
  type Segmentation,
  type SegmentModel,
  segmentationSchema,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import type { OverviewMetricSource } from '../overview/overview-metric.js';
import { readDecisions } from './consolidation.js';
import { aggregateSegmentation } from './segmentation.js';

const notFound = () =>
  new NotFoundException({ statusCode: 404, code: 'nicht_gefunden', message: 'Nicht gefunden.' });

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });

const closed = () =>
  new HttpException(
    { statusCode: 409, code: 'round_closed', message: 'Die Runde ist nicht mehr offen.' },
    409,
  );

function translate(error: unknown): never {
  const cause = (error as { cause?: { message?: string } }).cause;
  if (cause?.message?.startsWith('round_closed:')) throw closed();
  throw error;
}

const supplierName = sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`;

interface Row extends Omit<RatingAssignment, 'raterName'> {
  raterId: string | null;
  raterName: string | null;
  modelVersion: number | null;
  consolidated: boolean;
  roundCreated: Date;
  roundScope: 'portfolio' | 'category';
  roundGroupId: string | null;
}

interface Viewer {
  userId: string;
  admin: boolean;
  sroOf: Set<string>;
  // Runde und Business Unit der eigenen Einladungen: Wer dieselbe BU bewertet, sieht deren Werte.
  ownUnits: Set<string>;
  seesSuppliers: boolean;
  // WG-18: Lead und Commodity Manager sehen die Bewertungen der Runden ihrer Warengruppe.
  leadOf: Set<string>;
}

@Injectable()
export class RatingsService implements OverviewMetricSource {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private run<T>(
    auth: AuthContext,
    work: (tx: TenantTransaction, organization: AccountOrganization) => Promise<T>,
  ): Promise<T> {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant
      .run({ userId: auth.userId, organizationId: organization.id }, (tx) => work(tx, organization))
      .catch(translate);
  }

  private async viewer(tx: TenantTransaction, auth: AuthContext, orgId: string): Promise<Viewer> {
    const sro = await tx
      .select({ relationshipId: schema.relationshipMember.relationshipId })
      .from(schema.relationshipMember)
      .where(
        and(
          eq(schema.relationshipMember.orgId, orgId),
          eq(schema.relationshipMember.userId, auth.userId),
          eq(schema.relationshipMember.teamRole, 'sro'),
        ),
      );
    const own = await tx
      .select({
        roundId: schema.ratingAssignment.roundId,
        businessUnitId: schema.ratingAssignment.businessUnitId,
      })
      .from(schema.ratingAssignment)
      .where(eq(schema.ratingAssignment.raterUserId, auth.userId));
    const leads = await tx
      .select({ id: schema.materialGroup.id })
      .from(schema.materialGroup)
      .where(
        sql`${schema.materialGroup.leadUserId} = ${auth.userId} or ${schema.materialGroup.commodityManagerUserId} = ${auth.userId} or exists (
          select 1 from ${schema.materialGroupMember}
          where ${schema.materialGroupMember.materialGroupId} = ${schema.materialGroup.id}
            and ${schema.materialGroupMember.userId} = ${auth.userId}
            and ${schema.materialGroupMember.role} in ('lead', 'commodity_manager'))`,
      );
    return {
      leadOf: new Set(leads.map((row) => row.id)),
      userId: auth.userId,
      admin: auth.orgRole === 'admin',
      sroOf: new Set(sro.map((row) => row.relationshipId)),
      ownUnits: new Set(own.map((row) => `${row.roundId}:${row.businessUnitId}`)),
      seesSuppliers: can(
        { orgRole: auth.orgRole, isControlling: auth.isControlling, isOperator: auth.isOperator },
        'lieferanten.sehen',
      ),
    };
  }

  private manages(viewer: Viewer, row: Row) {
    return viewer.admin || viewer.sroOf.has(row.relationshipId);
  }

  /** Wer eine Bewertung sehen darf, richtet sich nach der Tabelle in SEG-04. */
  private visible(viewer: Viewer, row: Row, roundId: string, unitId: string) {
    return (
      this.manages(viewer, row) ||
      row.raterId === viewer.userId ||
      (row.roundScope === 'category' &&
        row.roundGroupId !== null &&
        viewer.leadOf.has(row.roundGroupId)) ||
      (row.consolidated && viewer.seesSuppliers) ||
      viewer.ownUnits.has(`${roundId}:${unitId}`)
    );
  }

  private async rows(tx: TenantTransaction, orgId: string, where: ReturnType<typeof and>) {
    return tx
      .select({
        id: schema.ratingAssignment.id,
        roundId: schema.segmentationRound.id,
        roundName: schema.segmentationRound.name,
        roundStatus: schema.segmentationRound.status,
        dueDate: schema.segmentationRound.dueDate,
        modelVersion: schema.segmentationRound.modelVersion,
        // Ab der ersten Konsolidierung der Beziehung sehen alle Käufer-Nutzer alle Bewertungen (SEG-06).
        consolidated: sql<boolean>`exists (select 1 from ${schema.segmentDecision} where ${schema.segmentDecision.relationshipId} = ${schema.ratingAssignment.relationshipId} and ${schema.segmentDecision.scope} <> 'category')`,
        roundCreated: schema.segmentationRound.createdAt,
        roundScope: schema.segmentationRound.scope,
        roundGroupId: schema.segmentationRound.materialGroupId,
        relationshipId: schema.ratingAssignment.relationshipId,
        supplier: supplierName,
        unitId: schema.businessUnit.id,
        unitName: schema.businessUnit.name,
        groupId: schema.materialGroup.id,
        groupName: schema.materialGroup.name,
        function: schema.ratingAssignment.function,
        status: schema.ratingAssignment.status,
        raterId: schema.ratingAssignment.raterUserId,
        raterName: schema.appUser.name,
      })
      .from(schema.ratingAssignment)
      .innerJoin(
        schema.segmentationRound,
        eq(schema.segmentationRound.id, schema.ratingAssignment.roundId),
      )
      .innerJoin(
        schema.relationship,
        eq(schema.relationship.id, schema.ratingAssignment.relationshipId),
      )
      .innerJoin(schema.organization, eq(schema.organization.id, schema.relationship.supplierOrgId))
      .leftJoin(
        schema.relationshipSide,
        and(
          eq(schema.relationshipSide.relationshipId, schema.relationship.id),
          eq(schema.relationshipSide.orgId, orgId),
        ),
      )
      .innerJoin(
        schema.businessUnit,
        eq(schema.businessUnit.id, schema.ratingAssignment.businessUnitId),
      )
      .leftJoin(
        schema.materialGroup,
        eq(schema.materialGroup.id, schema.ratingAssignment.materialGroupId),
      )
      .leftJoin(schema.appUser, eq(schema.appUser.id, schema.ratingAssignment.raterUserId))
      .where(
        and(
          eq(schema.segmentationRound.orgId, orgId),
          inArray(schema.segmentationRound.status, ['open', 'closed']),
          where,
        ),
      )
      .orderBy(
        asc(schema.segmentationRound.dueDate),
        asc(supplierName),
        asc(schema.businessUnit.name),
      );
  }

  private toRow(row: Awaited<ReturnType<RatingsService['rows']>>[number]): Row & {
    unitId: string;
  } {
    return {
      id: row.id,
      roundId: row.roundId,
      roundName: row.roundName,
      roundStatus: row.roundStatus,
      dueDate: row.dueDate,
      relationshipId: row.relationshipId,
      supplier: row.supplier,
      businessUnit: { id: row.unitId, name: row.unitName },
      materialGroup: row.groupId && row.groupName ? { id: row.groupId, name: row.groupName } : null,
      function: row.function,
      status: row.status,
      raterId: row.raterId,
      raterName: row.raterName,
      modelVersion: row.modelVersion,
      consolidated: row.consolidated,
      roundCreated: row.roundCreated,
      roundScope: row.roundScope,
      roundGroupId: row.roundGroupId,
      unitId: row.unitId,
    };
  }

  private publish(viewer: Viewer, row: Row): RatingAssignment {
    const {
      raterId: _raterId,
      modelVersion: _modelVersion,
      consolidated: _consolidated,
      roundCreated: _roundCreated,
      roundScope: _roundScope,
      roundGroupId: _roundGroupId,
      ...rest
    } = row;
    // Den Namen der bewertenden Person sehen nur SRO und Admin (NF-03).
    return { ...rest, raterName: this.manages(viewer, row) ? row.raterName : null };
  }

  async mine(auth: AuthContext): Promise<RatingAssignmentList> {
    return this.run(auth, async (tx, organization) => {
      const viewer = await this.viewer(tx, auth, organization.id);
      const rows = await this.rows(
        tx,
        organization.id,
        eq(schema.ratingAssignment.raterUserId, auth.userId),
      );
      return ratingAssignmentListSchema.parse({
        assignments: rows.map((row) => this.publish(viewer, this.toRow(row))),
      });
    });
  }

  /** Quelle für Start (NAV-05): offene Bewertungen der angemeldeten Person in laufenden Runden. */
  async dueItems(auth: AuthContext): Promise<DueItem[]> {
    return this.run(auth, async (tx, organization) => {
      const rows = await this.rows(
        tx,
        organization.id,
        eq(schema.ratingAssignment.raterUserId, auth.userId),
      );
      return rows
        .filter((row) => row.roundStatus === 'open' && row.status !== 'submitted')
        .map((row) => ({
          id: row.id,
          kind: 'rating' as const,
          supplier: row.supplier,
          detail: row.unitName,
          dueDate: row.dueDate,
          href: `/bewertungen/${row.id}`,
        }));
    });
  }

  /**
   * SEG-05: Einordnung eines Lieferanten aus der neuesten Runde mit abgegebenen Bewertungen, die der
   * Nutzer sehen darf (Regel aus SEG-04). Vorläufig, solange die Runde nicht konsolidiert ist.
   * Ohne `category` zählen nur Portfolio-Runden; mit `category` nur die Runden dieser Warengruppe
   * (WG-18), dann ohne Konsolidierung aus SEG-06.
   */
  async segmentationIn(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
    relationshipId: string,
    category?: string,
  ): Promise<Segmentation> {
    const viewer = await this.viewer(tx, auth, orgId);
    const all = (
      await this.rows(tx, orgId, eq(schema.ratingAssignment.relationshipId, relationshipId))
    )
      .map((row) => this.toRow(row))
      .filter(
        (row) =>
          row.status === 'submitted' &&
          (category
            ? row.roundScope === 'category' && row.roundGroupId === category
            : row.roundScope === 'portfolio') &&
          this.visible(viewer, row, row.roundId, row.unitId),
      );
    const latest = all.reduce<Row | null>(
      (best, row) => (!best || row.roundCreated > best.roundCreated ? row : best),
      null,
    );
    if (!latest) return segmentationSchema.parse({ segmentation: null });
    const rows = all.filter((row) => row.roundId === latest.roundId);
    const model = await this.model(tx, orgId, latest.modelVersion);
    const stored = await tx
      .select()
      .from(schema.rating)
      .where(
        inArray(
          schema.rating.assignmentId,
          rows.map((row) => row.id),
        ),
      );
    const input = rows.map((row) => ({
      id: row.id,
      businessUnit: row.businessUnit,
      materialGroup: row.materialGroup,
      function: row.function,
      values: model.criteria.map((criterion) => {
        const entry = stored.find(
          (item) => item.assignmentId === row.id && item.criterionKey === criterion.key,
        );
        return {
          criterionKey: criterion.key,
          ist: entry?.ist ?? null,
          soll: entry?.soll ?? null,
          comment: entry?.comment ?? null,
        };
      }),
    }));
    const outcome = (values: Parameters<RatingsService['outcome']>[1], field: 'ist' | 'soll') =>
      this.outcome(model, values, field);
    const decisions = category ? [] : await readDecisions(tx, orgId, relationshipId);
    const status = decisions.length > 0 ? ('consolidated' as const) : ('provisional' as const);
    const aggregated = aggregateSegmentation(model, input, outcome);
    return segmentationSchema.parse({
      segmentation: {
        roundId: latest.roundId,
        roundName: latest.roundName,
        status,
        model,
        overall: aggregated.overall,
        decision: decisions[0] ?? null,
        groups: aggregated.groups.map((group) => ({ ...group, status })),
        rows: aggregated.rows.map((row) => ({ ...row, assignmentId: row.id })),
        stats: aggregated.stats,
      },
    });
  }

  /** Strategie im Überblick (NAV-06): Soll-Typ aus den sichtbaren Bewertungen. */
  async overviewMetric(
    relationshipId: string,
    user: AuthContext,
    tx: TenantTransaction,
  ): Promise<OverviewMetric | null> {
    const organization = user.organization;
    if (!organization?.buyer) return null;
    const { segmentation } = await this.segmentationIn(tx, user, organization.id, relationshipId);
    const decided = segmentation?.decision?.entries.find((entry) => entry.scope === 'total');
    const target = decided?.soll ?? segmentation?.overall.soll;
    if (!segmentation || !target) return null;
    return {
      tile: 'strategy',
      kind: 'segment_target',
      typeName: target.typeName,
      provisional: !decided,
    };
  }

  async segmentation(auth: AuthContext, relationshipId: string): Promise<Segmentation> {
    return this.run(auth, (tx, organization) =>
      this.segmentationIn(tx, auth, organization.id, relationshipId),
    );
  }

  async forRelationship(auth: AuthContext, relationshipId: string): Promise<RatingAssignmentList> {
    return this.run(auth, async (tx, organization) => {
      const viewer = await this.viewer(tx, auth, organization.id);
      const rows = await this.rows(
        tx,
        organization.id,
        eq(schema.ratingAssignment.relationshipId, relationshipId),
      );
      return ratingAssignmentListSchema.parse({
        assignments: rows
          .map((row) => this.toRow(row))
          .filter((row) => this.visible(viewer, row, row.roundId, row.unitId))
          .map((row) => this.publish(viewer, row)),
      });
    });
  }

  async get(auth: AuthContext, id: string): Promise<RatingDetail> {
    return this.run(auth, (tx, organization) => this.detail(tx, auth, organization.id, id));
  }

  private async load(tx: TenantTransaction, orgId: string, id: string) {
    const [row] = await this.rows(tx, orgId, eq(schema.ratingAssignment.id, id));
    if (!row) throw notFound();
    return this.toRow(row);
  }

  private async model(tx: TenantTransaction, orgId: string, version: number | null) {
    if (version === null) throw notFound();
    const [header] = await tx
      .select()
      .from(schema.segmentModel)
      .where(and(eq(schema.segmentModel.orgId, orgId), eq(schema.segmentModel.version, version)));
    if (!header) throw notFound();
    const criteria = await tx
      .select()
      .from(schema.segmentCriterion)
      .where(eq(schema.segmentCriterion.modelId, header.id))
      .orderBy(asc(schema.segmentCriterion.axis), asc(schema.segmentCriterion.position));
    const types = await tx
      .select()
      .from(schema.segmentType)
      .where(eq(schema.segmentType.modelId, header.id))
      .orderBy(asc(schema.segmentType.impactLevel), asc(schema.segmentType.qualityLevel));
    return {
      version: header.version,
      // E-K0-33 (K2-b.1): 2 × 2 oder 3 × 3 je Modell
      gridSize: header.gridSize === 2 ? 2 : 3,
      lowMax: header.lowMax,
      midMax: header.midMax,
      criteria,
      types,
    } satisfies Pick<
      SegmentModel,
      'version' | 'gridSize' | 'lowMax' | 'midMax' | 'criteria' | 'types'
    >;
  }

  private outcome(
    model: Awaited<ReturnType<RatingsService['model']>>,
    values: { criterionKey: string; ist: number | null; soll: number | null }[],
    field: 'ist' | 'soll',
  ): RatingOutcome | null {
    const scores: Record<string, number> = {};
    for (const criterion of model.criteria) {
      const value = values.find((entry) => entry.criterionKey === criterion.key)?.[field];
      if (value === null || value === undefined) return null;
      scores[criterion.key] = value;
    }
    const result = calculateSegment(model, scores);
    return {
      impactScore: result.impactScore,
      qualityScore: result.qualityScore,
      impactLevel: result.impactLevel,
      qualityLevel: result.qualityLevel,
      typeName: result.type.name,
    };
  }

  private async detail(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
    id: string,
  ): Promise<RatingDetail> {
    const viewer = await this.viewer(tx, auth, orgId);
    const row = await this.load(tx, orgId, id);
    if (!this.visible(viewer, row, row.roundId, row.unitId)) throw notFound();
    const model = await this.model(tx, orgId, row.modelVersion);
    const stored = await tx.select().from(schema.rating).where(eq(schema.rating.assignmentId, id));
    const values = model.criteria.map((criterion) => {
      const entry = stored.find((item) => item.criterionKey === criterion.key);
      return {
        criterionKey: criterion.key,
        ist: entry?.ist ?? null,
        soll: entry?.soll ?? null,
        comment: entry?.comment ?? null,
      };
    });
    return ratingDetailSchema.parse({
      assignment: this.publish(viewer, row),
      editable: row.raterId === auth.userId && row.roundStatus === 'open',
      model,
      values,
      ist: this.outcome(model, values, 'ist'),
      soll: this.outcome(model, values, 'soll'),
    });
  }

  /** Nur die bewertende Person ändert, und nur solange die Runde läuft. */
  private async editable(tx: TenantTransaction, auth: AuthContext, orgId: string, id: string) {
    const viewer = await this.viewer(tx, auth, orgId);
    const row = await this.load(tx, orgId, id);
    if (!this.visible(viewer, row, row.roundId, row.unitId)) throw notFound();
    if (row.raterId !== auth.userId) throw forbidden();
    if (row.roundStatus !== 'open') throw closed();
    return row;
  }

  async save(auth: AuthContext, id: string, input: SaveRating): Promise<RatingDetail> {
    return this.run(auth, async (tx, organization) => {
      const row = await this.editable(tx, auth, organization.id, id);
      const model = await this.model(tx, organization.id, row.modelVersion);
      if (!model.criteria.some((criterion) => criterion.key === input.criterionKey)) {
        throw new HttpException(
          { statusCode: 400, code: 'unknown_criterion', message: 'Unbekanntes Kriterium.' },
          400,
        );
      }
      const changes = {
        ...(input.ist !== undefined ? { ist: input.ist } : {}),
        ...(input.soll !== undefined ? { soll: input.soll } : {}),
        ...(input.comment !== undefined ? { comment: input.comment || null } : {}),
        updatedAt: currentTime(),
      };
      await tx
        .insert(schema.rating)
        .values({
          assignmentId: id,
          relationshipId: row.relationshipId,
          criterionKey: input.criterionKey,
          modelVersion: model.version,
          ...changes,
        })
        .onConflictDoUpdate({
          target: [schema.rating.assignmentId, schema.rating.criterionKey],
          set: changes,
        });
      if (row.status === 'open') {
        await tx
          .update(schema.ratingAssignment)
          .set({ status: 'in_progress' })
          .where(eq(schema.ratingAssignment.id, id));
      }
      return this.detail(tx, auth, organization.id, id);
    });
  }

  async submit(auth: AuthContext, id: string): Promise<RatingDetail> {
    return this.run(auth, async (tx, organization) => {
      const row = await this.editable(tx, auth, organization.id, id);
      const model = await this.model(tx, organization.id, row.modelVersion);
      const stored = await tx
        .select()
        .from(schema.rating)
        .where(eq(schema.rating.assignmentId, id));
      const missing = model.criteria
        .filter((criterion) => {
          const entry = stored.find((item) => item.criterionKey === criterion.key);
          return entry?.ist == null || entry.soll == null;
        })
        .map((criterion) => criterion.key);
      if (missing.length) {
        throw new HttpException(
          {
            statusCode: 400,
            code: 'ratings_incomplete',
            message: 'Es fehlen Werte.',
            missing,
          },
          400,
        );
      }
      await tx
        .update(schema.rating)
        .set({ submittedAt: sql`coalesce(${schema.rating.submittedAt}, app_now())` })
        .where(eq(schema.rating.assignmentId, id));
      await tx
        .update(schema.ratingAssignment)
        .set({ status: 'submitted' })
        .where(eq(schema.ratingAssignment.id, id));
      return this.detail(tx, auth, organization.id, id);
    });
  }
}
