import {
  BadRequestException,
  ForbiddenException,
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
  type CategoryReview,
  type CategoryScorecard,
  categoryReviewSchema,
  categoryScorecardSchema,
  type HoldReview,
  horizonOf,
  type InitiativeProgress,
  type InitiativeRequest,
  initiativeProgressSchema,
  initiativeRequestSchema,
  type StrategyRole,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { StrategyService } from './strategy.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const invalid = (code: string) => new BadRequestException({ statusCode: 400, code });

const step = 7;
/** Wer ein Review abschließt (WG-12): Lead, Commodity Manager, Einkauf im Team, Admin */
const reviewers: StrategyRole[] = ['lead', 'commodity_manager', 'buyer', 'admin'];
const toNumber = (value: string | null) => (value === null ? null : Number(value));
const decimal = (value: number | null | undefined) =>
  value === undefined ? undefined : value === null ? null : String(value);

const supplierName = sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`;

/** Monate zwischen zwei Tagen, abgerundet (z. B. 15.01. bis 14.04. sind zwei Monate) */
function monthsBetween(from: Date, to: Date) {
  const months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  return to.getUTCDate() < from.getUTCDate() ? months - 1 : months;
}
function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next.toISOString().slice(0, 10);
}

/**
 * WG-12 (Schritt 27): Scorecard der Warengruppe und Quartals-Review. Jede Initiative zahlt auf genau
 * ein Ziel ein und gehört zu genau einer gewählten Hebelwahl. Alles org_private; eine Initiative der
 * Warengruppe ist nicht die geteilte Initiative des Impact-Ledgers.
 */
@Injectable()
export class ScorecardService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(StrategyService) private readonly strategies: StrategyService,
  ) {}

  private run<T>(
    auth: AuthContext,
    work: (tx: TenantTransaction, organization: AccountOrganization) => Promise<T>,
  ): Promise<T> {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, (tx) =>
      work(tx, organization),
    );
  }

  private async groupSuppliers(tx: TenantTransaction, orgId: string, groupId: string) {
    return tx
      .select({ relationshipId: schema.relationship.id, name: supplierName })
      .from(schema.relationshipMaterialGroup)
      .innerJoin(
        schema.relationship,
        eq(schema.relationship.id, schema.relationshipMaterialGroup.relationshipId),
      )
      .innerJoin(schema.organization, eq(schema.organization.id, schema.relationship.supplierOrgId))
      .leftJoin(
        schema.relationshipSide,
        and(
          eq(schema.relationshipSide.relationshipId, schema.relationship.id),
          eq(schema.relationshipSide.orgId, orgId),
        ),
      )
      .where(
        and(
          eq(schema.relationshipMaterialGroup.materialGroupId, groupId),
          eq(schema.relationship.buyerOrgId, orgId),
          sql`${schema.relationship.status} <> 'ended'`,
        ),
      )
      .orderBy(asc(supplierName));
  }

  /** Gewählte Hebel mit Kürzel der Paarung (z. B. „S1 · T2“) und Hebelname */
  private async chosenChoices(tx: TenantTransaction, strategyId: string) {
    const rows = await tx
      .select({
        id: schema.materialGroupLeverChoice.id,
        internalItemId: schema.materialGroupLeverChoice.internalItemId,
        externalItemId: schema.materialGroupLeverChoice.externalItemId,
        leverName: schema.strategyLever.name,
      })
      .from(schema.materialGroupLeverChoice)
      .innerJoin(
        schema.strategyLever,
        eq(schema.strategyLever.id, schema.materialGroupLeverChoice.leverId),
      )
      .where(
        and(
          eq(schema.materialGroupLeverChoice.strategyId, strategyId),
          eq(schema.materialGroupLeverChoice.status, 'chosen'),
        ),
      )
      .orderBy(asc(schema.materialGroupLeverChoice.createdAt));
    const items = await tx
      .select({ id: schema.materialGroupSwotItem.id, code: schema.materialGroupSwotItem.code })
      .from(schema.materialGroupSwotItem)
      .where(eq(schema.materialGroupSwotItem.strategyId, strategyId));
    const code = (id: string) => items.find((item) => item.id === id)?.code ?? '?';
    return rows.map((row) => ({
      id: row.id,
      pairing: `${code(row.internalItemId)} · ${code(row.externalItemId)}`,
      leverName: row.leverName,
    }));
  }

  async scorecard(auth: AuthContext, strategyId: string): Promise<CategoryScorecard> {
    return this.run(auth, (tx, organization) => this.view(tx, auth, organization.id, strategyId));
  }

  private async view(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
    strategyId: string,
  ): Promise<CategoryScorecard> {
    const access = await this.strategies.accessIn(tx, auth, strategyId);
    const canEdit = access.editableSteps.includes(step);
    const rows = await tx
      .select({ initiative: schema.materialGroupInitiative, ownerName: schema.appUser.name })
      .from(schema.materialGroupInitiative)
      .leftJoin(schema.appUser, eq(schema.appUser.id, schema.materialGroupInitiative.ownerUserId))
      .where(eq(schema.materialGroupInitiative.strategyId, strategyId))
      .orderBy(asc(schema.materialGroupInitiative.createdAt));
    const links = rows.length
      ? await tx
          .select({
            initiativeId: schema.materialGroupInitiativeSupplier.initiativeId,
            relationshipId: schema.materialGroupInitiativeSupplier.relationshipId,
          })
          .from(schema.materialGroupInitiativeSupplier)
          .where(
            inArray(
              schema.materialGroupInitiativeSupplier.initiativeId,
              rows.map((row) => row.initiative.id),
            ),
          )
      : [];
    const suppliers = await this.groupSuppliers(tx, orgId, access.group.id);
    const goals = await tx
      .select({
        id: schema.materialGroupGoal.id,
        dimension: schema.materialGroupKpi.dimension,
        text: schema.materialGroupGoal.text,
        kpiName: schema.materialGroupKpi.name,
      })
      .from(schema.materialGroupGoal)
      .innerJoin(
        schema.materialGroupKpi,
        eq(schema.materialGroupKpi.id, schema.materialGroupGoal.kpiId),
      )
      .where(
        and(
          eq(schema.materialGroupGoal.strategyId, strategyId),
          eq(schema.materialGroupGoal.deferred, false),
        ),
      )
      .orderBy(asc(schema.materialGroupGoal.createdAt));
    const choices = await this.chosenChoices(tx, strategyId);
    const people = canEdit
      ? await tx
          .select({ userId: schema.appUser.id, name: schema.appUser.name })
          .from(schema.appUser)
          .where(eq(schema.appUser.organizationId, orgId))
          .orderBy(asc(schema.appUser.name))
      : [];
    const reviews = await tx
      .select({
        id: schema.materialGroupReview.id,
        dueOn: schema.materialGroupReview.dueOn,
        heldAt: schema.materialGroupReview.heldAt,
      })
      .from(schema.materialGroupReview)
      .where(eq(schema.materialGroupReview.strategyId, strategyId))
      .orderBy(asc(schema.materialGroupReview.dueOn));
    const covered = new Set(rows.map((row) => row.initiative.leverChoiceId));
    return categoryScorecardSchema.parse({
      canEdit,
      initiatives: rows.map(({ initiative, ownerName }) => ({
        id: initiative.id,
        goalId: initiative.goalId,
        leverChoiceId: initiative.leverChoiceId,
        name: initiative.name,
        effect: initiative.effect,
        actual: toNumber(initiative.actual),
        target: toNumber(initiative.target),
        ownerUserId: initiative.ownerUserId,
        ownerName,
        targetQuarter: initiative.targetQuarter,
        targetYear: initiative.targetYear,
        horizon: horizonOf(initiative.targetYear, access.strategy.year),
        progress: initiative.progress,
        suppliers: links
          .filter((link) => link.initiativeId === initiative.id)
          .map((link) => ({
            relationshipId: link.relationshipId,
            name:
              suppliers.find((entry) => entry.relationshipId === link.relationshipId)?.name ?? '',
          })),
        canReport: canEdit || initiative.ownerUserId === auth.userId,
      })),
      goals,
      choices,
      missingChoiceIds: choices.filter((choice) => !covered.has(choice.id)).map((c) => c.id),
      suppliers,
      people,
      reviews: reviews.map((review) => ({
        id: review.id,
        dueOn: review.dueOn,
        heldAt: review.heldAt?.toISOString() ?? null,
      })),
    });
  }

  /** Prüft Ziel, Hebelwahl, Verantwortliche und Lieferanten gegen diese Strategie */
  private async values(
    tx: TenantTransaction,
    orgId: string,
    strategyId: string,
    groupId: string,
    input: InitiativeRequest,
  ) {
    const parsed = initiativeRequestSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues[0]?.message ?? 'invalid');
    const request = parsed.data;
    const [goal] = await tx
      .select({ id: schema.materialGroupGoal.id })
      .from(schema.materialGroupGoal)
      .where(
        and(
          eq(schema.materialGroupGoal.id, request.goalId),
          eq(schema.materialGroupGoal.strategyId, strategyId),
          eq(schema.materialGroupGoal.deferred, false),
        ),
      );
    if (!goal) throw invalid('goal_required');
    const [choice] = await tx
      .select({ id: schema.materialGroupLeverChoice.id })
      .from(schema.materialGroupLeverChoice)
      .where(
        and(
          eq(schema.materialGroupLeverChoice.id, request.leverChoiceId),
          eq(schema.materialGroupLeverChoice.strategyId, strategyId),
          eq(schema.materialGroupLeverChoice.status, 'chosen'),
        ),
      );
    if (!choice) throw invalid('lever_required');
    if (request.ownerUserId) {
      const [owner] = await tx
        .select({ id: schema.appUser.id })
        .from(schema.appUser)
        .where(
          and(eq(schema.appUser.id, request.ownerUserId), eq(schema.appUser.organizationId, orgId)),
        );
      if (!owner) throw invalid('owner_unknown');
    }
    const allowed = new Set(
      (await this.groupSuppliers(tx, orgId, groupId)).map((entry) => entry.relationshipId),
    );
    if (request.supplierIds.some((id) => !allowed.has(id))) throw invalid('supplier_not_in_group');
    return {
      row: {
        goalId: request.goalId,
        leverChoiceId: request.leverChoiceId,
        name: request.name,
        effect: request.effect,
        actual: decimal(request.actual) ?? null,
        target: decimal(request.target) ?? null,
        ownerUserId: request.ownerUserId ?? null,
        targetQuarter: request.targetQuarter ?? null,
        targetYear: request.targetYear ?? null,
      },
      supplierIds: [...new Set(request.supplierIds)],
    };
  }

  private async setSuppliers(
    tx: TenantTransaction,
    orgId: string,
    strategyId: string,
    initiativeId: string,
    supplierIds: string[],
  ) {
    await tx
      .delete(schema.materialGroupInitiativeSupplier)
      .where(eq(schema.materialGroupInitiativeSupplier.initiativeId, initiativeId));
    if (supplierIds.length) {
      await tx.insert(schema.materialGroupInitiativeSupplier).values(
        supplierIds.map((relationshipId) => ({
          orgId,
          strategyId,
          initiativeId,
          relationshipId,
        })),
      );
    }
  }

  private async editable(tx: TenantTransaction, auth: AuthContext, strategyId: string) {
    const access = await this.strategies.accessIn(tx, auth, strategyId);
    if (!access.editableSteps.includes(step)) throw forbidden();
    return access;
  }

  create(auth: AuthContext, strategyId: string, input: InitiativeRequest) {
    return this.run(auth, async (tx, organization) => {
      const access = await this.editable(tx, auth, strategyId);
      const { row, supplierIds } = await this.values(
        tx,
        organization.id,
        strategyId,
        access.group.id,
        input,
      );
      const [created] = await tx
        .insert(schema.materialGroupInitiative)
        .values({ ...row, orgId: organization.id, strategyId })
        .returning({ id: schema.materialGroupInitiative.id });
      if (!created) throw notFound();
      await this.setSuppliers(tx, organization.id, strategyId, created.id, supplierIds);
      await this.strategies.touchedIn(tx, access.strategy);
      return this.view(tx, auth, organization.id, strategyId);
    });
  }

  update(auth: AuthContext, strategyId: string, id: string, input: InitiativeRequest) {
    return this.run(auth, async (tx, organization) => {
      const access = await this.editable(tx, auth, strategyId);
      const { row, supplierIds } = await this.values(
        tx,
        organization.id,
        strategyId,
        access.group.id,
        input,
      );
      const updated = await tx
        .update(schema.materialGroupInitiative)
        .set(row)
        .where(
          and(
            eq(schema.materialGroupInitiative.id, id),
            eq(schema.materialGroupInitiative.strategyId, strategyId),
          ),
        )
        .returning({ id: schema.materialGroupInitiative.id });
      if (!updated.length) throw notFound();
      await this.setSuppliers(tx, organization.id, strategyId, id, supplierIds);
      await this.strategies.touchedIn(tx, access.strategy);
      return this.view(tx, auth, organization.id, strategyId);
    });
  }

  remove(auth: AuthContext, strategyId: string, id: string) {
    return this.run(auth, async (tx, organization) => {
      const access = await this.editable(tx, auth, strategyId);
      const removed = await tx
        .delete(schema.materialGroupInitiative)
        .where(
          and(
            eq(schema.materialGroupInitiative.id, id),
            eq(schema.materialGroupInitiative.strategyId, strategyId),
          ),
        )
        .returning({ id: schema.materialGroupInitiative.id });
      if (!removed.length) throw notFound();
      await this.strategies.touchedIn(tx, access.strategy);
      return this.view(tx, auth, organization.id, strategyId);
    });
  }

  /** Fortschritt melden: die verantwortliche Person, auch nach der Freigabe, oder das Team */
  progress(auth: AuthContext, strategyId: string, id: string, input: InitiativeProgress) {
    const request = initiativeProgressSchema.parse(input);
    return this.run(auth, async (tx, organization) => {
      const access = await this.strategies.accessIn(tx, auth, strategyId);
      const [row] = await tx
        .select({ ownerUserId: schema.materialGroupInitiative.ownerUserId })
        .from(schema.materialGroupInitiative)
        .where(
          and(
            eq(schema.materialGroupInitiative.id, id),
            eq(schema.materialGroupInitiative.strategyId, strategyId),
          ),
        );
      if (!row) throw notFound();
      if (!access.editableSteps.includes(step) && row.ownerUserId !== auth.userId)
        throw forbidden();
      await tx
        .update(schema.materialGroupInitiative)
        .set({
          progress: request.progress,
          ...(request.actual !== undefined ? { actual: decimal(request.actual) ?? null } : {}),
        })
        .where(eq(schema.materialGroupInitiative.id, id));
      return this.view(tx, auth, organization.id, strategyId);
    });
  }

  /**
   * Täglicher Job: je freigegebener Strategie alle drei Monate nach der Freigabe genau ein Review
   * (je Fälligkeit eines, die Datenbank verhindert Doppelte). Gibt die Zahl neuer Reviews zurück.
   */
  async createDueReviews(orgId: string, now = currentTime()): Promise<number> {
    return this.tenant.run({ userId: 'system:warengruppen', organizationId: orgId }, async (tx) => {
      const strategies = await tx
        .select({
          id: schema.materialGroupStrategy.id,
          approvedAt: schema.materialGroupStrategy.approvedAt,
        })
        .from(schema.materialGroupStrategy)
        .where(
          and(
            eq(schema.materialGroupStrategy.orgId, orgId),
            eq(schema.materialGroupStrategy.status, 'approved'),
          ),
        );
      let created = 0;
      for (const strategy of strategies) {
        if (!strategy.approvedAt) continue;
        const quarters = Math.floor(monthsBetween(strategy.approvedAt, now) / 3);
        if (quarters < 1) continue;
        const rows = await tx
          .insert(schema.materialGroupReview)
          .values({
            orgId,
            strategyId: strategy.id,
            dueOn: addMonths(strategy.approvedAt, quarters * 3),
          })
          .onConflictDoNothing()
          .returning({ id: schema.materialGroupReview.id });
        created += rows.length;
      }
      return created;
    });
  }

  private async reviewRow(tx: TenantTransaction, reviewId: string) {
    const [row] = await tx
      .select()
      .from(schema.materialGroupReview)
      .where(eq(schema.materialGroupReview.id, reviewId));
    if (!row) throw notFound();
    return row;
  }

  review(auth: AuthContext, reviewId: string): Promise<CategoryReview> {
    return this.run(auth, (tx, organization) => this.reviewIn(tx, auth, organization.id, reviewId));
  }

  /**
   * Review: je Initiative Fortschritt und Beitrag zum Ziel, dazu offene Zusagen und Maßnahmen nur
   * bei Lieferanten dieser Warengruppe.
   */
  private async reviewIn(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
    reviewId: string,
  ): Promise<CategoryReview> {
    const review = await this.reviewRow(tx, reviewId);
    const access = await this.strategies.accessIn(tx, auth, review.strategyId);
    const initiatives = await tx
      .select({
        initiative: schema.materialGroupInitiative,
        goal: schema.materialGroupGoal.text,
        lever: schema.strategyLever.name,
        ownerName: schema.appUser.name,
      })
      .from(schema.materialGroupInitiative)
      .innerJoin(
        schema.materialGroupGoal,
        eq(schema.materialGroupGoal.id, schema.materialGroupInitiative.goalId),
      )
      .innerJoin(
        schema.materialGroupLeverChoice,
        eq(schema.materialGroupLeverChoice.id, schema.materialGroupInitiative.leverChoiceId),
      )
      .innerJoin(
        schema.strategyLever,
        eq(schema.strategyLever.id, schema.materialGroupLeverChoice.leverId),
      )
      .leftJoin(schema.appUser, eq(schema.appUser.id, schema.materialGroupInitiative.ownerUserId))
      .where(eq(schema.materialGroupInitiative.strategyId, review.strategyId))
      .orderBy(asc(schema.materialGroupInitiative.createdAt));
    const suppliers = await this.groupSuppliers(tx, orgId, access.group.id);
    const ids = suppliers.map((entry) => entry.relationshipId);
    const nameOf = (id: string) =>
      suppliers.find((entry) => entry.relationshipId === id)?.name ?? '';
    const commitments = ids.length
      ? await tx
          .select({
            id: schema.commitment.id,
            relationshipId: schema.commitment.relationshipId,
            title: schema.commitment.title,
            dueOn: schema.commitment.dueOn,
            side: schema.commitment.side,
          })
          .from(schema.commitment)
          .where(
            and(
              inArray(schema.commitment.relationshipId, ids),
              eq(schema.commitment.status, 'open'),
            ),
          )
          .orderBy(asc(schema.commitment.dueOn))
          .limit(50)
      : [];
    const actions = ids.length
      ? await tx
          .select({
            id: schema.action.id,
            relationshipId: schema.action.relationshipId,
            title: schema.action.title,
            dueDate: schema.action.dueDate,
            status: schema.action.status,
          })
          .from(schema.action)
          .where(
            and(
              inArray(schema.action.relationshipId, ids),
              inArray(schema.action.status, ['open', 'in_progress']),
            ),
          )
          .orderBy(asc(schema.action.dueDate))
          .limit(50)
      : [];
    const [heldBy] = review.heldBy
      ? await tx
          .select({ name: schema.appUser.name })
          .from(schema.appUser)
          .where(eq(schema.appUser.id, review.heldBy))
      : [];
    return categoryReviewSchema.parse({
      id: review.id,
      groupId: access.group.id,
      groupName: access.group.name,
      strategyId: review.strategyId,
      year: access.strategy.year,
      dueOn: review.dueOn,
      heldAt: review.heldAt?.toISOString() ?? null,
      heldBy: heldBy?.name ?? null,
      summary: review.summary,
      canHold:
        review.heldAt === null &&
        reviewers.includes(access.role) &&
        can(auth, 'warengruppenstrategie.bearbeiten'),
      initiatives: initiatives.map(({ initiative, goal, lever, ownerName }) => ({
        id: initiative.id,
        name: initiative.name,
        goal,
        lever,
        progress: initiative.progress,
        actual: toNumber(initiative.actual),
        target: toNumber(initiative.target),
        ownerName,
      })),
      commitments: commitments.map((entry) => ({
        ...entry,
        supplier: nameOf(entry.relationshipId),
      })),
      actions: actions.map((entry) => ({
        ...entry,
        supplier: nameOf(entry.relationshipId),
      })),
    });
  }

  /** Review abschließen: kurze Zusammenfassung, danach unveränderlich */
  hold(auth: AuthContext, reviewId: string, input: HoldReview) {
    return this.run(auth, async (tx, organization) => {
      const current = await this.reviewIn(tx, auth, organization.id, reviewId);
      if (!current.canHold) throw forbidden();
      await tx
        .update(schema.materialGroupReview)
        .set({ heldAt: currentTime(), heldBy: auth.userId, summary: input.summary })
        .where(eq(schema.materialGroupReview.id, reviewId));
      return this.reviewIn(tx, auth, organization.id, reviewId);
    });
  }
}
