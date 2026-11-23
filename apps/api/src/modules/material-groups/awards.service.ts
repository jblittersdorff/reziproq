import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  type AwardEligibility,
  type AwardIneligibleReason,
  type AwardPlan,
  type AwardRequest,
  awardEligibilitySchema,
  awardPlanComplete,
  awardPlanSchema,
  awardRequestSchema,
  defaultAwardEligibility,
  qualityDataSchema,
  revenueFinanceDataSchema,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { StrategyService } from './strategy.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const invalid = (code: string, extra: Record<string, unknown> = {}) =>
  new BadRequestException({ statusCode: 400, code, ...extra });

const step = 8;
const supplierName = sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`;

/** Bedingungen für Vergabefähigkeit der Organisation; ohne Eintrag die Startwerte */
export async function awardEligibilityOf(
  tx: TenantTransaction,
  orgId: string,
): Promise<AwardEligibility> {
  const [row] = await tx
    .select({ value: schema.orgSetting.value })
    .from(schema.orgSetting)
    .where(and(eq(schema.orgSetting.orgId, orgId), eq(schema.orgSetting.key, 'award_eligibility')));
  const parsed = awardEligibilitySchema.safeParse(row?.value);
  return parsed.success ? parsed.data : defaultAwardEligibility;
}

/**
 * Wählbare Lieferanten einer Strategie (WG-14): Beziehungen der Warengruppe mit dem Grund, warum sie
 * nicht vergabefähig sind, und Kandidaten aus der Lieferkettensicht (WG-07). Bedingungen: aktive
 * Beziehung immer; Qualitätsbewertung nicht C und Lieferkettenstabilität nicht „kritisch“, je nach
 * Einstellung. Kandidaten sind wählbar (Gründer, 23.11.2026), die Bedingungen gelten erst mit einer
 * Beziehung.
 */
export async function awardOptions(
  tx: TenantTransaction,
  orgId: string,
  strategyId: string,
  groupId: string,
) {
  const eligibility = await awardEligibilityOf(tx, orgId);
  const suppliers = await tx
    .select({
      id: schema.relationship.id,
      name: supplierName,
      status: schema.relationship.status,
    })
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
      ),
    )
    .orderBy(asc(supplierName));
  const analyses = await tx
    .select({ view: schema.materialGroupAnalysis.view, data: schema.materialGroupAnalysis.data })
    .from(schema.materialGroupAnalysis)
    .where(
      and(
        eq(schema.materialGroupAnalysis.strategyId, strategyId),
        inArray(schema.materialGroupAnalysis.view, ['quality', 'revenue_finance']),
      ),
    );
  const quality = qualityDataSchema.safeParse(
    analyses.find((row) => row.view === 'quality')?.data ?? {},
  );
  const stability = revenueFinanceDataSchema.safeParse(
    analyses.find((row) => row.view === 'revenue_finance')?.data ?? {},
  );
  const ended = new Set(
    (
      await tx
        .select({ relationshipId: schema.materialGroupSupplierMapRow.relationshipId })
        .from(schema.materialGroupSupplierMapRow)
        .where(
          and(
            eq(schema.materialGroupSupplierMapRow.strategyId, strategyId),
            eq(schema.materialGroupSupplierMapRow.ended, true),
          ),
        )
    ).map((row) => row.relationshipId),
  );
  const candidates = await tx
    .select({ id: schema.materialGroupCandidate.id, name: schema.materialGroupCandidate.name })
    .from(schema.materialGroupCandidate)
    .where(eq(schema.materialGroupCandidate.strategyId, strategyId))
    .orderBy(asc(schema.materialGroupCandidate.name));
  return {
    eligibility,
    options: [
      ...suppliers.map((supplier) => {
        const reasons: AwardIneligibleReason[] = [];
        if (supplier.status !== 'active') reasons.push('inactive');
        if (
          eligibility.qualityNotCritical &&
          quality.success &&
          quality.data.ratings.some(
            (entry) => entry.relationshipId === supplier.id && entry.rating === 'C',
          )
        ) {
          reasons.push('quality_critical');
        }
        if (
          eligibility.stabilityNotCritical &&
          stability.success &&
          stability.data.stability.some(
            (entry) => entry.relationshipId === supplier.id && entry.rating === 'critical',
          )
        ) {
          reasons.push('stability_critical');
        }
        return {
          kind: 'relationship' as const,
          id: supplier.id,
          name: supplier.name,
          eligible: reasons.length === 0,
          reasons,
          ended: ended.has(supplier.id),
        };
      }),
      ...candidates.map((candidate) => ({
        kind: 'candidate' as const,
        id: candidate.id,
        name: candidate.name,
        eligible: true,
        reasons: [],
        ended: false,
      })),
    ],
  };
}

/** Vergaben einer Strategie mit möglichen Lieferanten; für den Vergabeplan und Schritt 8 */
export async function awardsOf(
  tx: TenantTransaction,
  strategyId: string,
  options: Awaited<ReturnType<typeof awardOptions>>['options'],
) {
  const rows = await tx
    .select()
    .from(schema.materialGroupAward)
    .where(eq(schema.materialGroupAward.strategyId, strategyId))
    .orderBy(
      sql`coalesce(${schema.materialGroupAward.requestFrom}, ${schema.materialGroupAward.awardDate}) nulls last`,
      asc(schema.materialGroupAward.createdAt),
    );
  const links = rows.length
    ? await tx
        .select()
        .from(schema.materialGroupAwardSupplier)
        .where(
          inArray(
            schema.materialGroupAwardSupplier.awardId,
            rows.map((row) => row.id),
          ),
        )
    : [];
  const bundles = new Map<string, number>();
  for (const row of rows) {
    if (row.bundleKey) bundles.set(row.bundleKey, (bundles.get(row.bundleKey) ?? 0) + 1);
  }
  return rows.map((row) => {
    const suppliers = links
      .filter((link) => link.awardId === row.id)
      .map((link) => {
        const kind = link.relationshipId ? ('relationship' as const) : ('candidate' as const);
        const id = (link.relationshipId ?? link.candidateId) as string;
        const option = options.find((entry) => entry.kind === kind && entry.id === id);
        return {
          kind,
          id,
          name: option?.name ?? '',
          note: link.note,
          ended: option?.ended ?? false,
        };
      });
    return {
      id: row.id,
      name: row.name,
      volumeCents: row.volumeCents,
      currency: row.currency,
      requestFrom: row.requestFrom,
      requestTo: row.requestTo,
      awardDate: row.awardDate,
      bundleKey: row.bundleKey,
      bundled: row.bundleKey !== null && (bundles.get(row.bundleKey) ?? 0) > 1,
      suppliers,
      endedSuppliers: suppliers.filter((entry) => entry.ended).map((entry) => entry.name),
    };
  });
}

/**
 * WG-14 (Schritt 29): Vergabeplan der Warengruppenstrategie (Schritt 8). Lead, Commodity Manager
 * und Einkauf im Team legen Vergaben an; Admins stellen die Bedingungen für Vergabefähigkeit ein.
 * Alles org_private; der Lieferant sieht nie etwas davon.
 */
@Injectable()
export class AwardsService {
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

  plan(auth: AuthContext, strategyId: string): Promise<AwardPlan> {
    return this.run(auth, (tx, organization) => this.view(tx, auth, organization.id, strategyId));
  }

  private async view(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
    strategyId: string,
  ): Promise<AwardPlan> {
    const access = await this.strategies.accessIn(tx, auth, strategyId);
    const { eligibility, options } = await awardOptions(tx, orgId, strategyId, access.group.id);
    const awards = await awardsOf(tx, strategyId, options);
    return awardPlanSchema.parse({
      canEdit: access.editableSteps.includes(step),
      strategyYear: access.strategy.year,
      awards,
      options,
      eligibility,
      complete: awardPlanComplete(awards),
    });
  }

  private async editable(tx: TenantTransaction, auth: AuthContext, strategyId: string) {
    const access = await this.strategies.accessIn(tx, auth, strategyId);
    if (!access.editableSteps.includes(step)) throw forbidden();
    return access;
  }

  /** Prüft Felder und mögliche Lieferanten; nicht vergabefähige Lieferanten werden abgelehnt. */
  private async values(
    tx: TenantTransaction,
    orgId: string,
    strategyId: string,
    groupId: string,
    input: AwardRequest,
    /** Bereits zugeordnete Lieferanten bleiben beim Ändern erlaubt, auch wenn nicht mehr vergabefähig */
    kept: Set<string> = new Set(),
  ) {
    const parsed = awardRequestSchema.safeParse(input);
    if (!parsed.success) throw invalid(parsed.error.issues[0]?.message ?? 'invalid');
    const request = parsed.data;
    const { options } = await awardOptions(tx, orgId, strategyId, groupId);
    for (const supplier of request.suppliers) {
      const option = options.find(
        (entry) => entry.kind === supplier.kind && entry.id === supplier.id,
      );
      if (!option) throw invalid('supplier_not_in_group');
      if (!option.eligible && !kept.has(`${supplier.kind}:${supplier.id}`)) {
        throw invalid('supplier_not_eligible', { reasons: option.reasons });
      }
    }
    return request;
  }

  private async writeSuppliers(
    tx: TenantTransaction,
    orgId: string,
    strategyId: string,
    awardId: string,
    suppliers: ReturnType<typeof awardRequestSchema.parse>['suppliers'],
  ) {
    await tx
      .delete(schema.materialGroupAwardSupplier)
      .where(eq(schema.materialGroupAwardSupplier.awardId, awardId));
    const unique = [
      ...new Map(suppliers.map((entry) => [`${entry.kind}:${entry.id}`, entry])).values(),
    ];
    if (unique.length === 0) return;
    await tx.insert(schema.materialGroupAwardSupplier).values(
      unique.map((entry) => ({
        orgId,
        strategyId,
        awardId,
        relationshipId: entry.kind === 'relationship' ? entry.id : null,
        candidateId: entry.kind === 'candidate' ? entry.id : null,
        note: entry.note || null,
      })),
    );
  }

  create(auth: AuthContext, strategyId: string, input: AwardRequest): Promise<AwardPlan> {
    return this.run(auth, async (tx, organization) => {
      const access = await this.editable(tx, auth, strategyId);
      const request = await this.values(tx, organization.id, strategyId, access.group.id, input);
      const [award] = await tx
        .insert(schema.materialGroupAward)
        .values({
          orgId: organization.id,
          strategyId,
          name: request.name,
          volumeCents: request.volumeCents,
          currency: request.currency,
          requestFrom: request.requestFrom,
          requestTo: request.requestTo,
          awardDate: request.awardDate,
          bundleKey: request.bundleKey || null,
        })
        .returning({ id: schema.materialGroupAward.id });
      if (!award) throw notFound();
      await this.writeSuppliers(tx, organization.id, strategyId, award.id, request.suppliers);
      await this.strategies.touchedIn(tx, access.strategy);
      return this.view(tx, auth, organization.id, strategyId);
    });
  }

  update(
    auth: AuthContext,
    strategyId: string,
    awardId: string,
    input: AwardRequest,
  ): Promise<AwardPlan> {
    return this.run(auth, async (tx, organization) => {
      const access = await this.editable(tx, auth, strategyId);
      const existing = await tx
        .select({
          relationshipId: schema.materialGroupAwardSupplier.relationshipId,
          candidateId: schema.materialGroupAwardSupplier.candidateId,
        })
        .from(schema.materialGroupAwardSupplier)
        .where(eq(schema.materialGroupAwardSupplier.awardId, awardId));
      const kept = new Set(
        existing.map((row) =>
          row.relationshipId
            ? `relationship:${row.relationshipId}`
            : `candidate:${row.candidateId}`,
        ),
      );
      const request = await this.values(
        tx,
        organization.id,
        strategyId,
        access.group.id,
        input,
        kept,
      );
      const [award] = await tx
        .update(schema.materialGroupAward)
        .set({
          name: request.name,
          volumeCents: request.volumeCents,
          currency: request.currency,
          requestFrom: request.requestFrom,
          requestTo: request.requestTo,
          awardDate: request.awardDate,
          bundleKey: request.bundleKey || null,
        })
        .where(
          and(
            eq(schema.materialGroupAward.id, awardId),
            eq(schema.materialGroupAward.strategyId, strategyId),
          ),
        )
        .returning({ id: schema.materialGroupAward.id });
      if (!award) throw notFound();
      await this.writeSuppliers(tx, organization.id, strategyId, award.id, request.suppliers);
      await this.strategies.touchedIn(tx, access.strategy);
      return this.view(tx, auth, organization.id, strategyId);
    });
  }

  remove(auth: AuthContext, strategyId: string, awardId: string): Promise<AwardPlan> {
    return this.run(auth, async (tx, organization) => {
      const access = await this.editable(tx, auth, strategyId);
      const removed = await tx
        .delete(schema.materialGroupAward)
        .where(
          and(
            eq(schema.materialGroupAward.id, awardId),
            eq(schema.materialGroupAward.strategyId, strategyId),
          ),
        )
        .returning({ id: schema.materialGroupAward.id });
      if (removed.length === 0) throw notFound();
      await this.strategies.touchedIn(tx, access.strategy);
      return this.view(tx, auth, organization.id, strategyId);
    });
  }

  eligibility(auth: AuthContext): Promise<AwardEligibility> {
    return this.run(auth, (tx, organization) => awardEligibilityOf(tx, organization.id));
  }

  saveEligibility(auth: AuthContext, input: AwardEligibility): Promise<AwardEligibility> {
    return this.run(auth, async (tx, organization) => {
      const value = awardEligibilitySchema.parse(input);
      await tx
        .insert(schema.orgSetting)
        .values({ orgId: organization.id, key: 'award_eligibility', value, updatedBy: auth.userId })
        .onConflictDoUpdate({
          target: [schema.orgSetting.orgId, schema.orgSetting.key],
          set: { value, updatedBy: auth.userId, updatedAt: new Date() },
        });
      return awardEligibilityOf(tx, organization.id);
    });
  }
}
