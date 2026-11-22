import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  amountInRange,
  type EbitGoalRequest,
  fiscalYearOf,
  fiscalYearRange,
  type OverviewInsight,
  overviewInsightSchema,
  type SupplierRings,
  type SupplierTargetRequest,
  supplierRingsSchema,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { ImpactService } from './impact.service.js';
import {
  factsOf,
  focusRelationships,
  type InitiativeFacts,
  PortfolioService,
} from './portfolio.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });

/** Gesichert im Geschäftsjahr: EBIT-Ist nur aus Zeiträumen, die das Controlling freigegeben hat. */
function securedIn(facts: InitiativeFacts[], from: string, to: string) {
  return facts
    .filter((fact) => fact.effectType === 'ebit' && !fact.excluded)
    .flatMap((fact) => fact.realizedValues)
    .filter((value) => value.month >= from && value.month <= to)
    .reduce((sum, value) => sum + value.valueCents, 0);
}

/** Lead einer Warengruppe (WG-01); mit Admin pflegt er Jahresziel und gibt Lieferantenziele frei. */
async function isLead(tx: TenantTransaction, userId: string, relationshipId?: string) {
  const rows = await tx
    .select({ id: schema.materialGroup.id })
    .from(schema.materialGroup)
    .where(
      and(
        eq(schema.materialGroup.leadUserId, userId),
        eq(schema.materialGroup.active, true),
        relationshipId
          ? sql`exists (select 1 from relationship_material_group rg
              where rg.material_group_id = ${schema.materialGroup.id}
                and rg.relationship_id = ${relationshipId})`
          : undefined,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * AW-01: Beleg der Übersicht und des Lieferanten-Überblicks aus den bestehenden Daten (PNL,
 * JBP, Zusagen). Ohne Ziel gibt es keinen äußeren Ring; EBIT und Cash werden nie addiert.
 */
@Injectable()
export class InsightsService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(ImpactService) private readonly impact: ImpactService,
    @Inject(PortfolioService) private readonly portfolio: PortfolioService,
  ) {}

  private async goals(tx: TenantTransaction, orgId: string): Promise<Record<string, number>> {
    const [row] = await tx
      .select({ value: schema.orgSetting.value })
      .from(schema.orgSetting)
      .where(and(eq(schema.orgSetting.orgId, orgId), eq(schema.orgSetting.key, 'goal_ebit_year')));
    return row && typeof row.value === 'object' && row.value !== null
      ? (row.value as Record<string, number>)
      : {};
  }

  overview(auth: AuthContext, requestedYear?: number): Promise<OverviewInsight> {
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'wirkung.sehen')) throw forbidden();
    return this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => {
        const startMonth = await this.portfolio.startMonth(tx, organization.id);
        const today = new Date().toISOString().slice(0, 10);
        const fiscalYear = requestedYear ?? fiscalYearOf(today, startMonth);
        const [from, to] = fiscalYearRange(fiscalYear, startMonth);
        const focus = await focusRelationships(tx, organization.id);
        const ids = focus.map((entry) => entry.id);
        const facts = await factsOf(tx, ids, true);
        const counted = facts.filter((fact) => !fact.excluded && fact.effectType);
        const open = counted.filter((fact) => fact.effectType === 'ebit' && fact.maturity < 5);
        const plan = (list: InitiativeFacts[]) =>
          list.reduce((sum, fact) => sum + amountInRange(fact.values, from, to), 0);
        const approvedJbp = ids.length
          ? await tx
              .selectDistinct({ id: schema.jbp.relationshipId })
              .from(schema.jbp)
              .where(
                and(inArray(schema.jbp.relationshipId, ids), eq(schema.jbp.status, 'approved')),
              )
          : [];
        const goal = (await this.goals(tx, organization.id))[String(fiscalYear)] ?? null;
        return overviewInsightSchema.parse({
          fiscalYear,
          currency: 'EUR',
          securedEbitCents: securedIn(facts, from, to),
          goalEbitCents: goal,
          canSetGoal: auth.orgRole === 'admin' || (await isLead(tx, auth.userId)),
          focusTotal: focus.length,
          focusWithApprovedJbp: approvedJbp.length,
          inProgress: {
            lowCents: plan(open.filter((fact) => fact.maturity >= 3)),
            highCents: plan(open),
          },
          cashCents: plan(counted.filter((fact) => fact.effectType === 'cash')),
        });
      },
      { readOnly: true },
    );
  }

  /** Jahresziel EBIT je Geschäftsjahr; Admin oder Lead (vorläufig zu F2). */
  setGoal(auth: AuthContext, input: EbitGoalRequest) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      if (auth.orgRole !== 'admin' && !(await isLead(tx, auth.userId))) throw forbidden();
      const goals = { ...(await this.goals(tx, organization.id)) };
      if (input.amountCents === null) delete goals[String(input.year)];
      else goals[String(input.year)] = input.amountCents;
      await tx
        .insert(schema.orgSetting)
        .values({
          orgId: organization.id,
          key: 'goal_ebit_year',
          value: goals,
          updatedBy: auth.userId,
        })
        .onConflictDoUpdate({
          target: [schema.orgSetting.orgId, schema.orgSetting.key],
          set: { value: goals, updatedBy: auth.userId, updatedAt: new Date() },
        });
    });
  }

  supplierRings(
    auth: AuthContext,
    relationshipId: string,
    requestedYear?: number,
  ): Promise<SupplierRings> {
    if (!can(auth, 'wirkung.sehen')) throw forbidden();
    return this.impact.run(auth, relationshipId, async (scope) => {
      const { tx } = scope;
      const startMonth = await this.portfolio.startMonth(tx, scope.orgId);
      const today = new Date().toISOString().slice(0, 10);
      const fiscalYear = requestedYear ?? fiscalYearOf(today, startMonth);
      const [from, to] = fiscalYearRange(fiscalYear, startMonth);
      const facts = await factsOf(tx, [relationshipId], true);
      const [target] = await tx
        .select()
        .from(schema.relationshipEbitTarget)
        .where(
          and(
            eq(schema.relationshipEbitTarget.relationshipId, relationshipId),
            eq(schema.relationshipEbitTarget.year, fiscalYear),
          ),
        );
      // Zusagen beider Seiten, im Zeitraum fällig (bis heute); eingehalten = Stand „kept“
      const due = await tx
        .select({ status: schema.commitment.status })
        .from(schema.commitment)
        .where(
          and(
            eq(schema.commitment.relationshipId, relationshipId),
            sql`${schema.commitment.dueOn} >= ${from}::date`,
            sql`${schema.commitment.dueOn} <= least(${to}::date, ${today}::date)`,
          ),
        );
      const [chance] = await tx
        .select()
        .from(schema.valueOpportunity)
        .where(
          and(
            eq(schema.valueOpportunity.relationshipId, relationshipId),
            eq(schema.valueOpportunity.orgId, scope.orgId),
            eq(schema.valueOpportunity.status, 'new'),
            inArray(schema.valueOpportunity.confidence, ['high', 'medium']),
          ),
        )
        .orderBy(desc(schema.valueOpportunity.buyerLowCents))
        .limit(1);
      return supplierRingsSchema.parse({
        chance: chance
          ? {
              opportunityId: chance.id,
              templateKey: chance.templateKey,
              impactType: chance.impactType,
              low: chance.buyerLowCents,
              high: chance.buyerHighCents,
              confidence: chance.confidence,
            }
          : null,
        fiscalYear,
        currency: 'EUR',
        securedEbitCents: securedIn(facts, from, to),
        target: target
          ? {
              ebitTargetCents: target.ebitTargetCents,
              approved: target.approvedAt !== null,
              proposedBy: target.proposedBy,
            }
          : null,
        commitments: {
          due: due.length,
          keptOnTime: due.filter((row) => row.status === 'kept').length,
        },
        canPropose: scope.auth.orgRole === 'admin' || scope.teamRole === 'sro',
        canApprove:
          scope.auth.orgRole === 'admin' || (await isLead(tx, auth.userId, relationshipId)),
      });
    });
  }

  /** SRO oder Admin schlägt das Ziel vor; ein neuer Vorschlag braucht eine neue Freigabe. */
  proposeTarget(auth: AuthContext, relationshipId: string, input: SupplierTargetRequest) {
    return this.impact.run(auth, relationshipId, async (scope) => {
      if (scope.auth.orgRole !== 'admin' && scope.teamRole !== 'sro') throw forbidden();
      await scope.tx
        .insert(schema.relationshipEbitTarget)
        .values({
          orgId: scope.orgId,
          relationshipId,
          year: input.year,
          ebitTargetCents: input.amountCents,
          proposedBy: auth.userId,
        })
        .onConflictDoUpdate({
          target: [
            schema.relationshipEbitTarget.relationshipId,
            schema.relationshipEbitTarget.year,
          ],
          set: {
            ebitTargetCents: input.amountCents,
            proposedBy: auth.userId,
            approvedBy: null,
            approvedAt: null,
          },
        });
    });
  }

  /** Admin oder Lead einer Warengruppe des Lieferanten gibt frei. */
  approveTarget(auth: AuthContext, relationshipId: string, year: number) {
    return this.impact.run(auth, relationshipId, async (scope) => {
      if (
        scope.auth.orgRole !== 'admin' &&
        !(await isLead(scope.tx, auth.userId, relationshipId))
      ) {
        throw forbidden();
      }
      await scope.tx
        .update(schema.relationshipEbitTarget)
        .set({ approvedBy: auth.userId, approvedAt: new Date() })
        .where(
          and(
            eq(schema.relationshipEbitTarget.relationshipId, relationshipId),
            eq(schema.relationshipEbitTarget.year, year),
          ),
        );
    });
  }
}
