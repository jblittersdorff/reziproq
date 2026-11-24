import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  auditedChange,
  currentTime,
  desc,
  eq,
  inArray,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  amountInRange,
  annualRange,
  type Bridge,
  type EffectType,
  effectTypes,
  type FiscalYearSetting,
  fiscalYearOf,
  fiscalYearRange,
  type ImpactView,
  type MonthValue,
  type PortfolioImpact,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { orgSettingAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { CustomersService } from '../customers/customers.service.js';
import { ImpactService } from './impact.service.js';
import { maturityOf } from './maturity.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });

/** Eine Initiative mit allem, was Brücke und Portfolio brauchen. */
export interface InitiativeFacts {
  id: string;
  title: string;
  relationshipId: string;
  effectType: EffectType | null;
  /** Wirkungsbeginn: eingestellt, sonst Start der Initiative */
  effectiveFrom: string;
  maturity: number;
  values: MonthValue[];
  excluded: boolean;
  /** Ist in von Controlling freigegebenen Zeiträumen */
  realizedCents: number;
  /** AW-01: dieselben Ist-Werte je Monat, für „Gesichert“ in einem Zeitraum */
  realizedValues: { month: string; valueCents: number }[];
}

/** Was die Session sieht; RLS entscheidet, beim Lieferanten nur Geteiltes. */
export async function factsOf(
  tx: TenantTransaction,
  relationshipIds: string[],
  buyer: boolean,
): Promise<InitiativeFacts[]> {
  if (relationshipIds.length === 0) return [];
  const initiatives = await tx
    .select({
      id: schema.initiative.id,
      title: schema.initiative.title,
      relationshipId: schema.initiative.relationshipId,
      startsOn: schema.initiative.startsOn,
    })
    .from(schema.initiative)
    .where(inArray(schema.initiative.relationshipId, relationshipIds))
    .orderBy(asc(schema.initiative.startsOn), asc(schema.initiative.createdAt));
  const ids = initiatives.map((entry) => entry.id);
  if (ids.length === 0) return [];
  const values = await tx
    .select({
      initiativeId: schema.initiativeValue.initiativeId,
      month: schema.initiativeValue.month,
      kind: schema.initiativeValue.kind,
      valueCents: schema.initiativeValue.valueCents,
      effectType: schema.initiativeValue.effectType,
    })
    .from(schema.initiativeValue)
    .where(inArray(schema.initiativeValue.initiativeId, ids));
  // Wirkungsbeginn steht in der käuferprivaten Einrichtung; der Lieferant nimmt den Start.
  const impacts = buyer
    ? await tx
        .select({
          initiativeId: schema.initiativeImpact.initiativeId,
          effectiveFrom: schema.initiativeImpact.effectiveFrom,
          effectType: schema.initiativeImpact.effectType,
        })
        .from(schema.initiativeImpact)
        .where(inArray(schema.initiativeImpact.initiativeId, ids))
        .orderBy(desc(schema.initiativeImpact.updatedAt))
    : [];
  const references = buyer
    ? await tx
        .select({ initiativeId: schema.savingsReference.initiativeId })
        .from(schema.savingsReference)
        .where(inArray(schema.savingsReference.initiativeId, ids))
    : [];
  const approved = buyer
    ? await tx
        .select({
          initiativeId: schema.initiativeValidation.initiativeId,
          from: schema.initiativeValidation.periodFrom,
          to: schema.initiativeValidation.periodTo,
        })
        .from(schema.initiativeValidation)
        .where(
          and(
            inArray(schema.initiativeValidation.initiativeId, ids),
            eq(schema.initiativeValidation.status, 'approved'),
          ),
        )
    : [];
  const facts: InitiativeFacts[] = [];
  for (const entry of initiatives) {
    const own = values.filter((value) => value.initiativeId === entry.id);
    const impact = impacts.find((row) => row.initiativeId === entry.id);
    const periods = approved.filter((row) => row.initiativeId === entry.id);
    facts.push({
      id: entry.id,
      title: entry.title,
      relationshipId: entry.relationshipId,
      effectType: (own[0]?.effectType ?? impact?.effectType ?? null) as EffectType | null,
      effectiveFrom: impact?.effectiveFrom ?? entry.startsOn,
      maturity: (await maturityOf(tx, entry.id)).level,
      values: own.map(({ month, kind, valueCents }) => ({ month, kind, valueCents })),
      excluded: references.some((row) => row.initiativeId === entry.id),
      realizedCents: own
        .filter(
          (value) =>
            value.kind === 'actual' &&
            periods.some((period) => value.month >= period.from && value.month <= period.to),
        )
        .reduce((sum, value) => sum + value.valueCents, 0),
      realizedValues: own
        .filter(
          (value) =>
            value.kind === 'actual' &&
            periods.some((period) => value.month >= period.from && value.month <= period.to),
        )
        .map(({ month, valueCents }) => ({ month, valueCents })),
    });
  }
  return facts;
}

export function rangeOf(
  fact: InitiativeFacts,
  view: ImpactView,
  fiscalYear: number,
  startMonth: number,
) {
  return view === 'jahreswirkung'
    ? annualRange(fact.effectiveFrom)
    : fiscalYearRange(fiscalYear, startMonth);
}

/** Je Wirkungsart die Wirkung nach Reifegrad R1 bis R5; Seite und Export rechnen gleich. */
export function pipelineOf(facts: InitiativeFacts[], amount: (fact: InitiativeFacts) => number) {
  return effectTypes
    .map((effectType) => ({
      effectType,
      levels: [1, 2, 3, 4, 5].map((level) => ({
        level,
        amountCents: facts
          .filter((fact) => fact.effectType === effectType && fact.maturity === level)
          .reduce((sum, fact) => sum + amount(fact), 0),
      })),
    }))
    .filter((entry) => entry.levels.some((level) => level.amountCents !== 0));
}

/** Aktive Fokuslieferanten des Käufers (SEG-02) mit Namen. */
export async function focusRelationships(tx: TenantTransaction, orgId: string) {
  return tx
    .select({
      id: schema.relationship.id,
      name: sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`,
    })
    .from(schema.relationship)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.relationship.supplierOrgId))
    .innerJoin(
      schema.relationshipSide,
      and(
        eq(schema.relationshipSide.relationshipId, schema.relationship.id),
        eq(schema.relationshipSide.orgId, orgId),
      ),
    )
    .where(
      and(
        eq(schema.relationship.buyerOrgId, orgId),
        eq(schema.relationship.status, 'active'),
        eq(schema.relationshipSide.isFocus, true),
      ),
    );
}

export function fiscalYearsOf(facts: InitiativeFacts[], startMonth: number, current: number) {
  const years = new Set<number>([current]);
  for (const fact of facts) {
    for (const value of fact.values) years.add(fiscalYearOf(value.month, startMonth));
  }
  return [...years].sort((a, b) => a - b);
}

/**
 * PNL-10: P&L-Brücke je Beziehung (Käufer und Lieferant) und Wirkung im Portfolio der
 * Fokuslieferanten. Alles aus initiative_value, Reifegrad, Teilung und Savings-Verweis; nie eine
 * Summe über Wirkungsarten.
 */
@Injectable()
export class PortfolioService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(ImpactService) private readonly impact: ImpactService,
    @Inject(CustomersService) private readonly customers: CustomersService,
  ) {}

  async startMonth(tx: TenantTransaction, orgId: string) {
    const [row] = await tx
      .select({ value: schema.orgSetting.value })
      .from(schema.orgSetting)
      .where(
        and(
          eq(schema.orgSetting.orgId, orgId),
          eq(schema.orgSetting.key, 'fiscal_year_start_month'),
        ),
      );
    return typeof row?.value === 'number' ? row.value : 1;
  }

  private bridgeOf(
    facts: InitiativeFacts[],
    view: ImpactView,
    requestedYear: number | undefined,
    startMonth: number,
  ): Bridge {
    const today = currentTime().toISOString().slice(0, 10);
    const fiscalYear = requestedYear ?? fiscalYearOf(today, startMonth);
    const counted = facts.filter((fact) => !fact.excluded && fact.effectType);
    const amount = (fact: InitiativeFacts) =>
      amountInRange(fact.values, ...rangeOf(fact, view, fiscalYear, startMonth));
    const steps = counted
      .filter((fact) => fact.effectType === 'ebit')
      .map((fact) => ({
        initiativeId: fact.id,
        title: fact.title,
        maturity: fact.maturity,
        amountCents: amount(fact),
      }))
      .filter((step) => step.amountCents !== 0)
      .sort((a, b) => b.amountCents - a.amountCents);
    const others = effectTypes
      .filter((type) => type !== 'ebit')
      .map((effectType) => ({
        effectType,
        amountCents: counted
          .filter((fact) => fact.effectType === effectType)
          .reduce((sum, fact) => sum + amount(fact), 0),
      }))
      .filter((entry) => entry.amountCents !== 0);
    return {
      view,
      fiscalYear,
      fiscalYearStartMonth: startMonth,
      fiscalYears: fiscalYearsOf(facts, startMonth, fiscalYear),
      steps,
      ebitTotal: steps.reduce((sum, step) => sum + step.amountCents, 0),
      others,
      excluded: facts
        .filter((fact) => fact.excluded)
        .map((fact) => ({ initiativeId: fact.id, title: fact.title })),
    };
  }

  bridge(auth: AuthContext, relationshipId: string, view: ImpactView, fiscalYear?: number) {
    return this.impact.run(auth, relationshipId, async (scope) => {
      const facts = await factsOf(scope.tx, [relationshipId], true);
      return this.bridgeOf(facts, view, fiscalYear, await this.startMonth(scope.tx, scope.orgId));
    });
  }

  /** Lieferant: nur geteilte Werte (RLS); das Geschäftsjahr des Kunden ist privat, also Januar. */
  customerBridge(auth: AuthContext, relationshipId: string, view: ImpactView, fiscalYear?: number) {
    return this.customers.inCustomer(auth, relationshipId, async (tx) => {
      const facts = await factsOf(tx, [relationshipId], false);
      return this.bridgeOf(facts, view, fiscalYear, 1);
    });
  }

  portfolio(auth: AuthContext, view: ImpactView, requestedYear?: number): Promise<PortfolioImpact> {
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'wirkung.sehen')) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const startMonth = await this.startMonth(tx, organization.id);
      const today = currentTime().toISOString().slice(0, 10);
      const fiscalYear = requestedYear ?? fiscalYearOf(today, startMonth);
      // Fokuslieferanten des Käufers (SEG-02), aktive Beziehungen.
      const focus = await focusRelationships(tx, organization.id);
      const ids = focus.map((entry) => entry.id);
      const facts = (await factsOf(tx, ids, true)).filter(
        (fact) => !fact.excluded && fact.effectType,
      );
      const amount = (fact: InitiativeFacts, year = fiscalYear) =>
        amountInRange(fact.values, ...rangeOf(fact, view, year, startMonth));

      const pipeline = pipelineOf(facts, (fact) => amount(fact));

      // EBIT je BU über drei Geschäftsjahre; in der Jahreswirkung zählt jede Initiative einmal.
      const years = [fiscalYear - 1, fiscalYear, fiscalYear + 1];
      const units = ids.length
        ? await tx
            .select({
              relationshipId: schema.relationshipBusinessUnit.relationshipId,
              id: schema.businessUnit.id,
              name: schema.businessUnit.name,
            })
            .from(schema.relationshipBusinessUnit)
            .innerJoin(
              schema.businessUnit,
              eq(schema.businessUnit.id, schema.relationshipBusinessUnit.businessUnitId),
            )
            .where(inArray(schema.relationshipBusinessUnit.relationshipId, ids))
        : [];
      const rows = new Map<
        string | null,
        { id: string | null; name: string | null; amounts: number[] }
      >();
      for (const fact of facts.filter((entry) => entry.effectType === 'ebit')) {
        const ofRelationship = units.filter((unit) => unit.relationshipId === fact.relationshipId);
        const targets = ofRelationship.length > 0 ? ofRelationship : [{ id: null, name: null }];
        for (const target of targets) {
          const row = rows.get(target.id) ?? {
            id: target.id,
            name: target.name,
            amounts: years.map(() => 0),
          };
          years.forEach((year, index) => {
            const value =
              view === 'jahreswirkung'
                ? fiscalYearOf(fact.effectiveFrom, startMonth) === year
                  ? amount(fact, year)
                  : 0
                : amountInRange(fact.values, ...fiscalYearRange(year, startMonth));
            row.amounts[index] = (row.amounts[index] ?? 0) + value;
          });
          rows.set(target.id, row);
        }
      }

      const top = focus
        .map((entry) => ({
          relationshipId: entry.id,
          name: entry.name,
          realizedCents: facts
            .filter((fact) => fact.relationshipId === entry.id && fact.effectType === 'ebit')
            .reduce((sum, fact) => sum + fact.realizedCents, 0),
        }))
        .filter((entry) => entry.realizedCents !== 0)
        .sort((a, b) => b.realizedCents - a.realizedCents)
        .slice(0, 5);

      return {
        view,
        fiscalYear,
        fiscalYearStartMonth: startMonth,
        fiscalYears: fiscalYearsOf(facts, startMonth, fiscalYear),
        focusSuppliers: focus.length,
        pipeline,
        businessUnits: {
          years,
          rows: [...rows.values()].sort((a, b) =>
            a.id === null
              ? 1
              : b.id === null
                ? -1
                : (a.name ?? '').localeCompare(b.name ?? '', 'de'),
          ),
        },
        top,
      };
    });
  }

  fiscalYearSetting(auth: AuthContext): Promise<FiscalYearSetting> {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run(
      { userId: auth.userId, organizationId: organization.id },
      async (tx) => ({
        startMonth: await this.startMonth(tx, organization.id),
      }),
    );
  }

  saveFiscalYearSetting(auth: AuthContext, input: FiscalYearSetting): Promise<FiscalYearSetting> {
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'einstellungen.verwalten')) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const before = await this.startMonth(tx, organization.id);
      const actor = await actorOf(tx, auth, organization.id);
      await auditedChange(tx, actor, orgSettingAudit, async () => {
        await tx
          .insert(schema.orgSetting)
          .values({
            orgId: organization.id,
            key: 'fiscal_year_start_month',
            value: input.startMonth,
            updatedBy: auth.userId,
          })
          .onConflictDoUpdate({
            target: [schema.orgSetting.orgId, schema.orgSetting.key],
            set: { value: input.startMonth, updatedBy: auth.userId, updatedAt: sql`app_now()` },
          });
        return {
          objectId: organization.id,
          relationshipId: null,
          action: 'updated' as const,
          before: { fiscal_year_start_month: before },
          after: { fiscal_year_start_month: input.startMonth },
          result: undefined,
        };
      });
      return { startMonth: input.startMonth };
    });
  }
}
