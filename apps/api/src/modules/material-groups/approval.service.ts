import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  type ApprovalSettings,
  type ApprovalSettingsView,
  type ApprovalView,
  approvalRouteOf,
  approvalSettingsSchema,
  approvalViewSchema,
  commodityManagerRequired,
  defaultApprovalSettings,
  type RelevanceOverride,
  relevanceOverrideSchema,
  relevanceRequestSchema,
  relevanceScore,
  returnRequestSchema,
  type SubmitBlocker,
  type SummaryPart,
  type SummaryRequest,
  summaryRequestSchema,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { StrategyService } from './strategy.service.js';
import { copyStrategyContent } from './strategy-copy.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const invalid = (code: string) => new BadRequestException({ statusCode: 400, code });

const step = 10;
const parts: SummaryPart[] = ['statusQuo', 'targetState', 'roadmap'];
type StrategyRow = typeof schema.materialGroupStrategy.$inferSelect;
type GroupRow = typeof schema.materialGroup.$inferSelect;

/** Einstellungen des Freigabewegs der Organisation; ohne Eintrag die Startwerte */
async function settingsOf(tx: TenantTransaction, orgId: string): Promise<ApprovalSettings> {
  const [row] = await tx
    .select({ value: schema.orgSetting.value })
    .from(schema.orgSetting)
    .where(and(eq(schema.orgSetting.orgId, orgId), eq(schema.orgSetting.key, 'category_approval')));
  const parsed = approvalSettingsSchema.safeParse(row?.value);
  return parsed.success ? parsed.data : defaultApprovalSettings;
}

/**
 * WG-16 (Schritt 30): Freigabe der Warengruppenstrategie (Schritt 10). Der Lead legt vor, wenn die
 * Schritte 2 bis 9 fertig sind, die Zusammenfassung bestätigt und die Relevanz eingeschätzt ist; das
 * Vorlegen ist seine Unterschrift. Commodity Manager (bei hoher Relevanz) und alle Freigebenden des
 * Wegs unterschreiben; Freigebende können mit Kommentar zurückgeben. Eine freigegebene Strategie
 * ändert sich nicht: Eine Änderung beginnt eine neue Version im Entwurf.
 */
@Injectable()
export class ApprovalService {
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

  private isAdmin(auth: AuthContext) {
    return auth.orgRole === 'admin' && can(auth, 'stammdaten.verwalten');
  }

  private async relevanceOf(tx: TenantTransaction, group: GroupRow, year: number) {
    const [row] = await tx
      .select()
      .from(schema.materialGroupRelevance)
      .where(
        and(
          eq(schema.materialGroupRelevance.materialGroupId, group.id),
          eq(schema.materialGroupRelevance.year, year),
        ),
      );
    return row ?? null;
  }

  /** Relevanz hoch oder gering; ohne Einschätzung und ohne Übersteuern null */
  private relevanceHigh(
    row: Awaited<ReturnType<ApprovalService['relevanceOf']>>,
    settings: ApprovalSettings,
  ): boolean | null {
    if (row?.override) return row.override === 'high';
    if (!row || row.score === null) return null;
    return Number(row.score) >= settings.relevanceThreshold;
  }

  /** Jüngste Vorlage: Unterschriften mit dem spätesten submitted_at */
  private async currentApprovals(tx: TenantTransaction, strategyId: string) {
    const a = schema.materialGroupApproval;
    const [latest] = await tx
      .select({ at: sql<Date | null>`max(${a.submittedAt})` })
      .from(a)
      .where(eq(a.strategyId, strategyId));
    if (!latest?.at) return [];
    return tx
      .select({ approval: a, name: schema.appUser.name })
      .from(a)
      .leftJoin(schema.appUser, eq(schema.appUser.id, a.userId))
      .where(and(eq(a.strategyId, strategyId), eq(a.submittedAt, new Date(latest.at))))
      .orderBy(
        sql`case ${a.role} when 'lead' then 0 when 'commodity_manager' then 1 else 2 end`,
        asc(schema.appUser.name),
      );
  }

  private async context(
    tx: TenantTransaction,
    orgId: string,
    strategy: StrategyRow,
    group: GroupRow,
  ) {
    const settings = await settingsOf(tx, orgId);
    const relevance = await this.relevanceOf(tx, group, strategy.year);
    const high = this.relevanceHigh(relevance, settings);
    const spend = await this.strategies.spendIn(tx, orgId, group.id);
    const spendHigh = (spend?.amountCents ?? 0) >= settings.spendThresholdCents;
    const route = high === null ? null : approvalRouteOf(high, spendHigh);
    return { settings, relevance, high, spend, spendHigh, route };
  }

  private async blockersOf(
    tx: TenantTransaction,
    auth: AuthContext,
    strategy: StrategyRow,
    group: GroupRow,
    role: string,
    context: Awaited<ReturnType<ApprovalService['context']>>,
  ) {
    const blockers: SubmitBlocker[] = [];
    if (strategy.status === 'approved') blockers.push('approved');
    if (role !== 'lead' || !can(auth, 'warengruppenstrategie.bearbeiten'))
      blockers.push('not_lead');
    const states = await this.strategies.stepStatesIn(tx, strategy, group);
    const openSteps = states
      .map((state, index) => ({ state, step: index + 1 }))
      .filter((entry) => entry.step >= 2 && entry.step <= 9 && entry.state !== 'done')
      .map((entry) => entry.step);
    if (openSteps.length > 0) blockers.push('steps_open');
    const [summary] = await tx
      .select({ status: schema.materialGroupSummary.status })
      .from(schema.materialGroupSummary)
      .where(eq(schema.materialGroupSummary.strategyId, strategy.id));
    if (summary?.status !== 'confirmed') blockers.push('summary_unconfirmed');
    if (context.route === null) blockers.push('relevance_missing');
    else {
      const approvers = context.settings.routes[context.route];
      const needsManager = commodityManagerRequired(context.route);
      if (approvers.length === 0 || (needsManager && !group.commodityManagerUserId)) {
        blockers.push('approvers_missing');
      }
    }
    return { blockers, openSteps };
  }

  view(auth: AuthContext, strategyId: string): Promise<ApprovalView> {
    return this.run(auth, (tx, organization) => this.viewIn(tx, auth, organization.id, strategyId));
  }

  private async viewIn(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
    strategyId: string,
  ): Promise<ApprovalView> {
    const access = await this.strategies.accessIn(tx, auth, strategyId);
    const { strategy, group, role } = access;
    const context = await this.context(tx, orgId, strategy, group);
    const { blockers, openSteps } = await this.blockersOf(tx, auth, strategy, group, role, context);
    const [summary] = await tx
      .select()
      .from(schema.materialGroupSummary)
      .where(eq(schema.materialGroupSummary.strategyId, strategy.id));
    const submitted = (summary?.submitted ?? null) as Record<SummaryPart, string> | null;
    const approvals = await this.currentApprovals(tx, strategy.id);
    // Unterschriften sehen das Team, Admins und wer selbst unterschreibt
    const team =
      role !== 'reader' || approvals.some(({ approval }) => approval.userId === auth.userId);
    const versions = await tx
      .select({
        id: schema.materialGroupStrategy.id,
        version: schema.materialGroupStrategy.version,
        status: schema.materialGroupStrategy.status,
      })
      .from(schema.materialGroupStrategy)
      .where(
        and(
          eq(schema.materialGroupStrategy.materialGroupId, group.id),
          eq(schema.materialGroupStrategy.year, strategy.year),
        ),
      )
      .orderBy(asc(schema.materialGroupStrategy.version));
    const latest = versions.at(-1)?.id === strategy.id;
    return approvalViewSchema.parse({
      strategyId: strategy.id,
      year: strategy.year,
      version: strategy.version,
      status: strategy.status,
      canEdit: access.editableSteps.includes(step),
      canSubmit: blockers.length === 0,
      blockers,
      openSteps,
      relevance: {
        scores: (context.relevance?.scores ?? {}) as Record<string, number>,
        score:
          context.relevance?.score === null || !context.relevance
            ? null
            : Number(context.relevance.score),
        override: context.relevance?.override ?? null,
        overrideReason: context.relevance?.overrideReason ?? null,
        high: context.high,
        canOverride: this.isAdmin(auth),
      },
      spend: context.spend
        ? {
            amountCents: context.spend.amountCents,
            currency: context.spend.currency,
            high: context.spendHigh,
          }
        : null,
      route: context.route,
      summary: {
        statusQuo: summary?.statusQuo ?? '',
        targetState: summary?.targetState ?? '',
        roadmap: summary?.roadmap ?? '',
        status: summary?.status ?? 'draft',
        changed:
          submitted && summary ? parts.filter((part) => submitted[part] !== summary[part]) : [],
      },
      lastSubmittedAt: strategy.lastSubmittedAt?.toISOString() ?? null,
      changedSinceSubmission: strategy.changedSinceSubmission,
      approvals: team
        ? approvals.map(({ approval, name }) => ({
            id: approval.id,
            role: approval.role,
            userId: approval.userId,
            name: name ?? approval.userId,
            status: approval.status,
            comment: approval.comment,
            decidedAt: approval.decidedAt?.toISOString() ?? null,
            canDecide:
              strategy.status === 'draft' &&
              approval.status === 'open' &&
              approval.userId === auth.userId &&
              approval.role !== 'lead',
          }))
        : [],
      versions: team ? versions : versions.filter((entry) => entry.status === 'approved'),
      canNewVersion:
        strategy.status === 'approved' &&
        latest &&
        can(auth, 'warengruppenstrategie.bearbeiten') &&
        ['lead', 'commodity_manager', 'admin'].includes(role),
    });
  }

  private async editable(tx: TenantTransaction, auth: AuthContext, strategyId: string) {
    const access = await this.strategies.accessIn(tx, auth, strategyId);
    if (!access.editableSteps.includes(step)) throw forbidden();
    return access;
  }

  saveRelevance(auth: AuthContext, strategyId: string, input: unknown): Promise<ApprovalView> {
    return this.run(auth, async (tx, organization) => {
      const access = await this.editable(tx, auth, strategyId);
      const parsed = relevanceRequestSchema.safeParse(input);
      if (!parsed.success) throw invalid('relevance_incomplete');
      const { scores } = parsed.data;
      const score = String(relevanceScore(scores));
      const existing = await this.relevanceOf(tx, access.group, access.strategy.year);
      if (existing) {
        await tx
          .update(schema.materialGroupRelevance)
          .set({ scores, score, updatedBy: auth.userId, updatedAt: new Date() })
          .where(eq(schema.materialGroupRelevance.id, existing.id));
      } else {
        await tx.insert(schema.materialGroupRelevance).values({
          orgId: organization.id,
          materialGroupId: access.group.id,
          year: access.strategy.year,
          scores,
          score,
          updatedBy: auth.userId,
        });
      }
      await this.strategies.touchedIn(tx, access.strategy);
      return this.viewIn(tx, auth, organization.id, strategyId);
    });
  }

  /** Admins übersteuern die Relevanz mit Begründung; null hebt das Übersteuern auf. */
  overrideRelevance(
    auth: AuthContext,
    strategyId: string,
    input: RelevanceOverride,
  ): Promise<ApprovalView> {
    return this.run(auth, async (tx, organization) => {
      if (!this.isAdmin(auth)) throw forbidden();
      const access = await this.strategies.accessIn(tx, auth, strategyId);
      if (access.strategy.status === 'approved') throw forbidden();
      const parsed = relevanceOverrideSchema.safeParse(input);
      if (!parsed.success) throw invalid('reason_required');
      const { override, reason } = parsed.data;
      const values = {
        override,
        overrideReason: override ? reason : null,
        updatedBy: auth.userId,
        updatedAt: new Date(),
      };
      const existing = await this.relevanceOf(tx, access.group, access.strategy.year);
      if (existing) {
        await tx
          .update(schema.materialGroupRelevance)
          .set(values)
          .where(eq(schema.materialGroupRelevance.id, existing.id));
      } else {
        await tx.insert(schema.materialGroupRelevance).values({
          orgId: organization.id,
          materialGroupId: access.group.id,
          year: access.strategy.year,
          ...values,
        });
      }
      return this.viewIn(tx, auth, organization.id, strategyId);
    });
  }

  saveSummary(auth: AuthContext, strategyId: string, input: SummaryRequest): Promise<ApprovalView> {
    return this.run(auth, async (tx, organization) => {
      const access = await this.editable(tx, auth, strategyId);
      const parsed = summaryRequestSchema.safeParse(input);
      if (!parsed.success) throw invalid('summary_invalid');
      const values = {
        ...parsed.data,
        status: 'draft' as const,
        updatedBy: auth.userId,
        updatedAt: new Date(),
      };
      const [existing] = await tx
        .select({ id: schema.materialGroupSummary.id })
        .from(schema.materialGroupSummary)
        .where(eq(schema.materialGroupSummary.strategyId, strategyId));
      if (existing) {
        await tx
          .update(schema.materialGroupSummary)
          .set(values)
          .where(eq(schema.materialGroupSummary.id, existing.id));
      } else {
        await tx
          .insert(schema.materialGroupSummary)
          .values({ orgId: organization.id, strategyId, ...values });
      }
      await this.strategies.touchedIn(tx, access.strategy);
      return this.viewIn(tx, auth, organization.id, strategyId);
    });
  }

  /** Zusammenfassung übernehmen: alle drei Teile müssen stehen. */
  confirmSummary(auth: AuthContext, strategyId: string): Promise<ApprovalView> {
    return this.run(auth, async (tx, organization) => {
      await this.editable(tx, auth, strategyId);
      const [summary] = await tx
        .select()
        .from(schema.materialGroupSummary)
        .where(eq(schema.materialGroupSummary.strategyId, strategyId));
      if (!summary || parts.some((part) => summary[part].trim().length === 0)) {
        throw invalid('summary_incomplete');
      }
      await tx
        .update(schema.materialGroupSummary)
        .set({ status: 'confirmed', updatedBy: auth.userId, updatedAt: new Date() })
        .where(eq(schema.materialGroupSummary.id, summary.id));
      return this.viewIn(tx, auth, organization.id, strategyId);
    });
  }

  /** Zur Freigabe vorlegen: legt die Unterschriften der Vorlage an; das Vorlegen unterschreibt der Lead. */
  submit(auth: AuthContext, strategyId: string): Promise<ApprovalView> {
    return this.run(auth, async (tx, organization) => {
      const access = await this.strategies.accessIn(tx, auth, strategyId);
      const { strategy, group, role } = access;
      const context = await this.context(tx, organization.id, strategy, group);
      const { blockers, openSteps } = await this.blockersOf(
        tx,
        auth,
        strategy,
        group,
        role,
        context,
      );
      if (blockers.length > 0) {
        throw new ConflictException({
          statusCode: 409,
          code: 'submit_blocked',
          blockers,
          openSteps,
        });
      }
      const route = context.route as NonNullable<typeof context.route>;
      const now = new Date();
      const rows: { role: 'lead' | 'commodity_manager' | 'approver'; userId: string }[] = [
        { role: 'lead', userId: auth.userId },
      ];
      if (commodityManagerRequired(route) && group.commodityManagerUserId) {
        rows.push({ role: 'commodity_manager', userId: group.commodityManagerUserId });
      }
      for (const userId of new Set(context.settings.routes[route])) {
        rows.push({ role: 'approver', userId });
      }
      await tx.insert(schema.materialGroupApproval).values(
        rows.map((row) => ({
          orgId: organization.id,
          strategyId,
          submittedAt: now,
          ...row,
          ...(row.role === 'lead' ? { status: 'signed' as const, decidedAt: now } : {}),
        })),
      );
      await tx
        .update(schema.materialGroupStrategy)
        .set({ status: 'draft', lastSubmittedAt: now, changedSinceSubmission: false })
        .where(eq(schema.materialGroupStrategy.id, strategyId));
      const [summary] = await tx
        .select()
        .from(schema.materialGroupSummary)
        .where(eq(schema.materialGroupSummary.strategyId, strategyId));
      if (summary) {
        await tx
          .update(schema.materialGroupSummary)
          .set({
            submitted: {
              statusQuo: summary.statusQuo,
              targetState: summary.targetState,
              roadmap: summary.roadmap,
            },
          })
          .where(eq(schema.materialGroupSummary.id, summary.id));
      }
      return this.viewIn(tx, auth, organization.id, strategyId);
    });
  }

  private async ownOpen(tx: TenantTransaction, auth: AuthContext, approvalId: string) {
    const [row] = await tx
      .select()
      .from(schema.materialGroupApproval)
      .where(eq(schema.materialGroupApproval.id, approvalId));
    if (!row) throw notFound();
    const current = await this.currentApprovals(tx, row.strategyId);
    if (!current.some(({ approval }) => approval.id === row.id)) throw invalid('approval_outdated');
    if (row.userId !== auth.userId || row.role === 'lead') throw forbidden();
    if (row.status !== 'open') throw invalid('approval_decided');
    const [strategy] = await tx
      .select()
      .from(schema.materialGroupStrategy)
      .where(eq(schema.materialGroupStrategy.id, row.strategyId));
    if (!strategy || strategy.status !== 'draft') throw invalid('approval_outdated');
    return { row, strategy, current };
  }

  /** Unterschreiben (Commodity Manager) oder Freigeben (Freigebende); alle unterschrieben heißt freigegeben. */
  sign(auth: AuthContext, approvalId: string): Promise<ApprovalView> {
    return this.run(auth, async (tx, organization) => {
      const { row, strategy, current } = await this.ownOpen(tx, auth, approvalId);
      const now = new Date();
      await tx
        .update(schema.materialGroupApproval)
        .set({ status: 'signed', decidedAt: now })
        .where(eq(schema.materialGroupApproval.id, row.id));
      const done = current.every(
        ({ approval }) => approval.id === row.id || approval.status === 'signed',
      );
      if (done) {
        await tx
          .update(schema.materialGroupStrategy)
          .set({ status: 'approved', approvedAt: now })
          .where(eq(schema.materialGroupStrategy.id, strategy.id));
      }
      return this.viewIn(tx, auth, organization.id, strategy.id);
    });
  }

  /** Zurückgeben zur Wiedervorlage: nur Freigebende, nur mit Kommentar. */
  returnStrategy(auth: AuthContext, approvalId: string, input: unknown): Promise<ApprovalView> {
    return this.run(auth, async (tx, organization) => {
      const parsed = returnRequestSchema.safeParse(input);
      if (!parsed.success) throw invalid('comment_required');
      const { row, strategy } = await this.ownOpen(tx, auth, approvalId);
      if (row.role !== 'approver') throw forbidden();
      await tx
        .update(schema.materialGroupApproval)
        .set({ status: 'returned', comment: parsed.data.comment, decidedAt: new Date() })
        .where(eq(schema.materialGroupApproval.id, row.id));
      await tx
        .update(schema.materialGroupStrategy)
        .set({ status: 'resubmit' })
        .where(eq(schema.materialGroupStrategy.id, strategy.id));
      return this.viewIn(tx, auth, organization.id, strategy.id);
    });
  }

  /** Neue Version einer freigegebenen Strategie im Entwurf; die freigegebene bleibt lesbar. */
  newVersion(auth: AuthContext, strategyId: string): Promise<{ id: string; version: number }> {
    return this.run(auth, async (tx) => {
      const access = await this.strategies.accessIn(tx, auth, strategyId);
      const { strategy, role } = access;
      if (
        !can(auth, 'warengruppenstrategie.bearbeiten') ||
        !['lead', 'commodity_manager', 'admin'].includes(role)
      ) {
        throw forbidden();
      }
      if (strategy.status !== 'approved') throw invalid('not_approved');
      const [latest] = await tx
        .select()
        .from(schema.materialGroupStrategy)
        .where(
          and(
            eq(schema.materialGroupStrategy.materialGroupId, strategy.materialGroupId),
            eq(schema.materialGroupStrategy.year, strategy.year),
          ),
        )
        .orderBy(desc(schema.materialGroupStrategy.version))
        .limit(1);
      if (latest && latest.id !== strategy.id) {
        throw new ConflictException({ statusCode: 409, code: 'version_exists', id: latest.id });
      }
      const created = await this.copy(
        tx,
        strategy,
        strategy.year,
        strategy.version + 1,
        auth.userId,
      );
      return { id: created.id, version: created.version };
    });
  }

  private async copy(
    tx: TenantTransaction,
    from: StrategyRow,
    year: number,
    version: number,
    createdBy: string,
  ) {
    const [created] = await tx
      .insert(schema.materialGroupStrategy)
      .values({
        orgId: from.orgId,
        materialGroupId: from.materialGroupId,
        year,
        version,
        status: 'draft',
        createdBy,
      })
      .returning();
    if (!created) throw notFound();
    await copyStrategyContent(tx, from, created);
    return created;
  }

  /**
   * Jahreswechsel (WG-16): Ab dem 1. Januar entsteht aus der jüngsten freigegebenen Strategie des
   * Vorjahrs genau ein Entwurf für das neue Jahr, wenn es für die Warengruppe noch keine Strategie
   * dieses Jahres gibt. Ersteller ist, wer die Vorlage angelegt hat.
   */
  async createNextYearDrafts(orgId: string, now = new Date()) {
    const year = now.getUTCFullYear();
    return this.tenant.run(
      { userId: 'system:jahreswechsel', organizationId: orgId },
      async (tx) => {
        const approved = await tx
          .select()
          .from(schema.materialGroupStrategy)
          .where(
            and(
              eq(schema.materialGroupStrategy.orgId, orgId),
              eq(schema.materialGroupStrategy.year, year - 1),
              eq(schema.materialGroupStrategy.status, 'approved'),
            ),
          )
          .orderBy(desc(schema.materialGroupStrategy.version));
        const groupsWithNext = new Set(
          (
            await tx
              .select({ groupId: schema.materialGroupStrategy.materialGroupId })
              .from(schema.materialGroupStrategy)
              .where(
                and(
                  eq(schema.materialGroupStrategy.orgId, orgId),
                  eq(schema.materialGroupStrategy.year, year),
                ),
              )
          ).map((row) => row.groupId),
        );
        const created: string[] = [];
        for (const strategy of approved) {
          if (groupsWithNext.has(strategy.materialGroupId)) continue;
          groupsWithNext.add(strategy.materialGroupId);
          const draft = await this.copy(tx, strategy, year, 1, strategy.createdBy);
          created.push(draft.id);
        }
        return created;
      },
    );
  }

  settings(auth: AuthContext): Promise<ApprovalSettingsView> {
    return this.run(auth, (tx, organization) => this.settingsIn(tx, auth, organization.id));
  }

  private async settingsIn(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
  ): Promise<ApprovalSettingsView> {
    return {
      settings: await settingsOf(tx, orgId),
      people: await tx
        .select({ userId: schema.appUser.id, name: schema.appUser.name })
        .from(schema.appUser)
        .where(eq(schema.appUser.organizationId, orgId))
        .orderBy(asc(schema.appUser.name)),
      canEdit: this.isAdmin(auth),
    };
  }

  saveSettings(auth: AuthContext, input: ApprovalSettings): Promise<ApprovalSettingsView> {
    if (!this.isAdmin(auth)) throw forbidden();
    return this.run(auth, async (tx, organization) => {
      const value = approvalSettingsSchema.parse(input);
      const people = new Set(
        (
          await tx
            .select({ id: schema.appUser.id })
            .from(schema.appUser)
            .where(eq(schema.appUser.organizationId, organization.id))
        ).map((row) => row.id),
      );
      if (Object.values(value.routes).some((ids) => ids.some((id) => !people.has(id)))) {
        throw invalid('unknown_person');
      }
      await tx
        .insert(schema.orgSetting)
        .values({ orgId: organization.id, key: 'category_approval', value, updatedBy: auth.userId })
        .onConflictDoUpdate({
          target: [schema.orgSetting.orgId, schema.orgSetting.key],
          set: { value, updatedBy: auth.userId, updatedAt: new Date() },
        });
      return this.settingsIn(tx, auth, organization.id);
    });
  }
}
