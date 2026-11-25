import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  and,
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
  type EbitGoalRequest,
  fiscalYearOf,
  fiscalYearRange,
  hintDetailSchema,
  type OpportunityTemplateKey,
  type OverviewInsight,
  overviewInsightSchema,
  type SecuredResults,
  type SupplierRings,
  type SupplierTargetRequest,
  securedResultsSchema,
  supplierRingsSchema,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import {
  type InsightFact,
  InsightSummaryService,
  type SentenceCandidate,
} from '../ai-gateway/insight-summary.service.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { templateTitles } from '../opportunities/templates.js';
import { ImpactService } from './impact.service.js';
import {
  factsOf,
  fiscalYearsOf,
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
    .filter((value) => value.month >= from && value.month < to)
    .reduce((sum, value) => sum + value.valueCents, 0);
}

/** Erster Tag des Monats `months` Monate nach `start` (JJJJ-MM-01) */
function shiftMonth(start: string, months: number) {
  const [year = 0, month = 1] = start.split('-').map(Number);
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`;
}

/** EBIT gesichert je Quartal des Geschäftsjahrs; Quartale nach heute bleiben leer */
function quartersOf(facts: InitiativeFacts[], from: string, today: string) {
  return [1, 2, 3, 4].map((quarter) => {
    const start = shiftMonth(from, (quarter - 1) * 3);
    const end = shiftMonth(from, quarter * 3);
    return {
      quarter,
      securedCents: securedIn(facts, start, end),
      state: (today < start ? 'future' : today < end ? 'current' : 'past') as
        | 'past'
        | 'current'
        | 'future',
    };
  });
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

const euro = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});
/** Betrag für Aussagen; dieselbe Schreibweise steht in den Fakten */
const money = (cents: number) => euro.format(Math.round(cents / 100));
const percent = (share: number) => `${Math.round(share * 100)}\u00a0%`;

/** Namen der Lieferanten der Organisation, wie die Liste sie zeigt */
async function supplierNames(tx: TenantTransaction, orgId: string) {
  const rows = await tx
    .select({
      id: schema.relationship.id,
      name: sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`,
    })
    .from(schema.relationship)
    .innerJoin(schema.organization, eq(schema.organization.id, schema.relationship.supplierOrgId))
    .leftJoin(
      schema.relationshipSide,
      and(
        eq(schema.relationshipSide.relationshipId, schema.relationship.id),
        eq(schema.relationshipSide.orgId, orgId),
      ),
    )
    .where(eq(schema.relationship.buyerOrgId, orgId));
  return new Map(rows.map((row) => [row.id, row.name]));
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
    @Inject(InsightSummaryService) private readonly summaries: InsightSummaryService,
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
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const startMonth = await this.portfolio.startMonth(tx, organization.id);
      const today = currentTime().toISOString().slice(0, 10);
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
            .where(and(inArray(schema.jbp.relationshipId, ids), eq(schema.jbp.status, 'approved')))
        : [];
      const goal = (await this.goals(tx, organization.id))[String(fiscalYear)] ?? null;
      const secured = securedIn(facts, from, to);
      const canSetGoal = auth.orgRole === 'admin' || (await isLead(tx, auth.userId));
      const inProgress = {
        lowCents: plan(open.filter((fact) => fact.maturity >= 3)),
        highCents: plan(open),
      };
      const insight = await this.overviewInsight(tx, auth, {
        fiscalYear,
        from,
        to,
        facts,
        secured,
        goal,
        canSetGoal,
        focusIds: ids,
        approvedIds: approvedJbp.map((row) => row.id),
        inProgress,
      });
      return overviewInsightSchema.parse({
        statement: insight.statement,
        sentences: insight.sentences,
        fiscalYear,
        currency: 'EUR',
        securedEbitCents: secured,
        goalEbitCents: goal,
        canSetGoal,
        focusTotal: focus.length,
        focusWithApprovedJbp: approvedJbp.length,
        inProgress,
        cashCents: plan(counted.filter((fact) => fact.effectType === 'cash')),
        quarters: quartersOf(facts, from, today),
        sinceStartSecuredCents: securedIn(facts, '0000-01-01', '9999-12-01'),
      });
    });
  }

  /**
   * NAV-10: Aussage und drei Sätze der Übersicht. Kandidaten wählt der Code; Reziproq formuliert,
   * jede Zahl und jeder Name muss in den Fakten stehen.
   */
  private async overviewInsight(
    tx: TenantTransaction,
    auth: AuthContext,
    input: {
      fiscalYear: number;
      from: string;
      to: string;
      facts: InitiativeFacts[];
      secured: number;
      goal: number | null;
      canSetGoal: boolean;
      focusIds: string[];
      approvedIds: string[];
      inProgress: { lowCents: number; highCents: number };
    },
  ) {
    const orgId = auth.organization?.id as string;
    const names = await supplierNames(tx, orgId);
    const source = 'Impact-Ledger, vom Controlling bestätigt';
    const facts: InsightFact[] = [
      { key: 'secured', label: 'Gesichert EBIT', display: money(input.secured), source },
      {
        key: 'focus',
        label: 'Fokuslieferanten mit freigegebenem JBP',
        display: `${input.approvedIds.length} von ${input.focusIds.length}`,
        source: 'Gemeinsame Pläne',
      },
      {
        key: 'inProgress',
        label: 'In Umsetzung',
        display: `${money(input.inProgress.lowCents)} bis ${money(input.inProgress.highCents)}`,
        source: 'Initiativen',
      },
    ];
    const share = input.goal ? input.secured / input.goal : null;
    if (input.goal && share !== null) {
      facts.push(
        {
          key: 'goal',
          label: `Jahresziel ${input.fiscalYear}`,
          display: money(input.goal),
          source,
        },
        { key: 'share', label: 'Anteil am Jahresziel', display: percent(share), source },
        {
          key: 'missing',
          label: 'Fehlt bis zum Jahresziel',
          display: money(Math.max(0, input.goal - input.secured)),
          source,
        },
      );
    }

    // Was gut läuft: der Lieferant mit dem höchsten gesicherten Beitrag
    const byRelationship = new Map<string, number>();
    for (const fact of input.facts) {
      if (fact.effectType !== 'ebit' || fact.excluded) continue;
      const value = fact.realizedValues
        .filter((entry) => entry.month >= input.from && entry.month <= input.to)
        .reduce((sum, entry) => sum + entry.valueCents, 0);
      byRelationship.set(
        fact.relationshipId,
        (byRelationship.get(fact.relationshipId) ?? 0) + value,
      );
    }
    const [bestId, bestValue] = [...byRelationship.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    const sentences: SentenceCandidate[] = [];
    const actions: string[] = [];
    if (bestId && bestValue && bestValue > 0) {
      const name = names.get(bestId) ?? '';
      facts.push(
        { key: 'bestName', label: 'Größter Beitrag', display: name, source },
        { key: 'bestValue', label: `Beitrag ${name}`, display: money(bestValue), source },
      );
      const goalShare = input.goal ? percent(bestValue / input.goal) : null;
      if (goalShare) {
        facts.push({
          key: 'bestShare',
          label: `Anteil ${name} am Ziel`,
          display: goalShare,
          source,
        });
      }
      sentences.push({
        kind: 'good',
        fallback: goalShare
          ? `${name} trägt ${money(bestValue)} bei, ${goalShare} des Jahresziels.`
          : `${name} trägt mit ${money(bestValue)} am meisten zum gesicherten EBIT bei.`,
        href: `/lieferanten/${bestId}/wirkung/bruecke`,
      });
    }

    // Was hakt: das größte offene Potenzial bei einem Fokuslieferanten ohne freigegebenen JBP
    const blocked = input.focusIds.filter((id) => !input.approvedIds.includes(id));
    const [stuck] = blocked.length
      ? await tx
          .select()
          .from(schema.valueOpportunity)
          .where(
            and(
              eq(schema.valueOpportunity.orgId, orgId),
              eq(schema.valueOpportunity.status, 'new'),
              inArray(schema.valueOpportunity.confidence, ['high', 'medium']),
              inArray(schema.valueOpportunity.relationshipId, blocked),
            ),
          )
          .orderBy(desc(schema.valueOpportunity.buyerHighCents))
          .limit(1)
      : [];
    if (stuck) {
      const name = names.get(stuck.relationshipId) ?? '';
      const range = `${money(stuck.buyerLowCents)} bis ${money(stuck.buyerHighCents)}`;
      facts.push(
        {
          key: 'stuckName',
          label: 'Potenzial ohne freigegebenen JBP',
          display: name,
          source: 'Wertpotenziale',
        },
        { key: 'stuckRange', label: `Potenzial ${name}`, display: range, source: 'Wertpotenziale' },
      );
      sentences.push({
        kind: 'stuck',
        fallback: `Bei ${name} wartet ein Potenzial von ${range} EBIT, der JBP ist noch nicht freigegeben.`,
        href: `/lieferanten/${stuck.relationshipId}/wirkung/wertpotenziale`,
      });
      actions.push(`den JBP mit ${name} freigeben`);
    } else if (can(auth, 'hinweise.sehen')) {
      // Sonst der offene Hinweis mit dem höchsten score, den die Person sieht (KI-16, NAV-10)
      const [hint] = await tx
        .execute<{
          id: string;
          relationship_id: string;
          title: string;
          suggested_action: string | null;
        }>(sql`
        select h.id, h.relationship_id, h.title, h.suggested_action from hint h
        where h.org_id = ${orgId} and h.status in ('open', 'in_progress')
          and h.relationship_id is not null and h.title is not null
          and (${auth.orgRole === 'admin'} or exists (
            select 1 from relationship_member m where m.relationship_id = h.relationship_id
              and m.org_id = ${orgId} and m.user_id = ${auth.userId}))
        order by h.score desc, h.created_at desc limit 1`)
        .then((result) => result.rows);
      if (hint) {
        const name = names.get(hint.relationship_id) ?? '';
        facts.push(
          { key: 'riskName', label: 'Größtes Risiko bei', display: name, source: 'Hinweise' },
          { key: 'riskTitle', label: 'Größtes Risiko', display: hint.title, source: 'Hinweise' },
        );
        sentences.push({
          kind: 'stuck',
          fallback: `Bei ${name}: ${hint.title.replace(/[.\s]+$/, '')}.`,
          href: `/warum/${hint.id}`,
        });
        if (hint.suggested_action) actions.push(`bei ${name}: ${hint.suggested_action}`);
      }
    }
    if (!input.goal && input.canSetGoal) actions.push('das Jahresziel festlegen');
    if (actions.length > 0) {
      sentences.push({
        kind: 'todo',
        fallback: `Als Nächstes: ${actions.slice(0, 2).join(' und ')}.`,
        href: '/heute',
      });
    }

    const headline =
      share !== null
        ? `Gesichert sind ${percent(share)} des Jahresziels.`
        : `Gesichert sind ${money(input.secured)} EBIT.`;
    const body =
      share !== null && input.goal
        ? `Bis zum Ende des Geschäftsjahrs fehlen ${money(Math.max(0, input.goal - input.secured))}. ${input.approvedIds.length} von ${input.focusIds.length} Fokuslieferanten haben einen freigegebenen JBP.`
        : `${input.approvedIds.length} von ${input.focusIds.length} Fokuslieferanten haben einen freigegebenen JBP. In Umsetzung sind ${money(input.inProgress.lowCents)} bis ${money(input.inProgress.highCents)}.`;
    return this.summaries.summarize(tx, auth, {
      pageKey: 'overview',
      scopeType: 'org',
      scopeId: null,
      period: String(input.fiscalYear),
      facts,
      fallback: { headline, body },
      sentences,
      knownNames: [...names.values()],
    });
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
          set: { value: goals, updatedBy: auth.userId, updatedAt: currentTime() },
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
      const today = currentTime().toISOString().slice(0, 10);
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
      // AW-01: Größtes Risiko, nur für Personen, die die Hinweise dieser Beziehung sehen (KI-16)
      const seesHints =
        can(auth, 'hinweise.sehen') && (auth.orgRole === 'admin' || scope.teamRole !== null);
      const [risk] = seesHints
        ? await tx
            .select({
              id: schema.hint.id,
              ruleKey: schema.hint.ruleKey,
              detail: schema.hint.detail,
              severity: schema.hint.severity,
              title: schema.hint.title,
            })
            .from(schema.hint)
            .where(
              and(
                eq(schema.hint.orgId, scope.orgId),
                eq(schema.hint.relationshipId, relationshipId),
                inArray(schema.hint.status, ['open', 'in_progress']),
              ),
            )
            .orderBy(desc(schema.hint.score), desc(schema.hint.createdAt))
            .limit(1)
        : [];
      const secured = securedIn(facts, from, to);
      const kept = due.filter((row) => row.status === 'kept').length;
      const approvedTarget = target?.approvedAt ? target.ebitTargetCents : null;
      const names = await supplierNames(tx, scope.orgId);
      const name = names.get(relationshipId) ?? '';
      const source = 'Impact-Ledger, vom Controlling bestätigt';
      const insightFacts: InsightFact[] = [
        { key: 'name', label: 'Lieferant', display: name, source: 'Lieferant' },
        { key: 'secured', label: 'Gesichert EBIT', display: money(secured), source },
        {
          key: 'commitments',
          label: 'Zusagen rechtzeitig eingehalten',
          display: `${kept} von ${due.length}`,
          source: 'Zusagen im JBP',
        },
      ];
      if (approvedTarget) {
        insightFacts.push(
          { key: 'target', label: `Ziel ${fiscalYear}`, display: money(approvedTarget), source },
          {
            key: 'share',
            label: 'Anteil am Ziel',
            display: percent(secured / approvedTarget),
            source,
          },
        );
      }
      const chanceText = chance
        ? `${templateTitles[chance.templateKey as OpportunityTemplateKey] ?? chance.title} mit ${money(chance.buyerLowCents)} bis ${money(chance.buyerHighCents)} EBIT`
        : null;
      if (chance && chanceText) {
        insightFacts.push({
          key: 'chance',
          label: 'Größte Chance',
          display: chanceText,
          source: 'Wertpotenziale',
        });
      }
      const insight = await this.summaries.summarize(tx, auth, {
        pageKey: 'supplier_overview',
        scopeType: 'relationship',
        scopeId: relationshipId,
        period: String(fiscalYear),
        facts: insightFacts,
        fallback: {
          headline: approvedTarget
            ? `Mit ${name} sind ${percent(secured / approvedTarget)} des Ziels gesichert.`
            : `Mit ${name} sind ${money(secured)} EBIT gesichert.`,
          body: [
            `${kept} von ${due.length} fälligen Zusagen wurden rechtzeitig eingehalten.`,
            ...(chanceText ? [`Die größte Chance ist ${chanceText}.`] : []),
          ].join(' '),
        },
        knownNames: [...names.values()],
      });
      return supplierRingsSchema.parse({
        statement: insight.statement,
        risk: risk
          ? {
              hintId: risk.id,
              ruleKey: risk.ruleKey,
              detail: hintDetailSchema.parse(risk.detail ?? {}),
              severity: risk.severity,
            }
          : null,
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
        securedEbitCents: secured,
        target: target
          ? {
              ebitTargetCents: target.ebitTargetCents,
              approved: target.approvedAt !== null,
              proposedBy: target.proposedBy,
            }
          : null,
        commitments: {
          due: due.length,
          keptOnTime: kept,
        },
        canPropose: scope.auth.orgRole === 'admin' || scope.teamRole === 'sro',
        canApprove:
          scope.auth.orgRole === 'admin' || (await isLead(tx, auth.userId, relationshipId)),
      });
    });
  }

  /**
   * AW-01 Ergebnisse · Gesichert: je Initiative der vom Controlling bestätigte EBIT-Beitrag im
   * Geschäftsjahr; die Summe ist dieselbe Zahl wie im Ring des Überblicks. Unbestätigte Ist-Monate
   * zählen nicht, sie stehen als offene Bestätigung daneben.
   */
  supplierSecured(
    auth: AuthContext,
    relationshipId: string,
    requestedYear?: number,
  ): Promise<SecuredResults> {
    if (!can(auth, 'wirkung.sehen')) throw forbidden();
    return this.impact.run(auth, relationshipId, async (scope) => {
      const { tx } = scope;
      const startMonth = await this.portfolio.startMonth(tx, scope.orgId);
      const today = currentTime().toISOString().slice(0, 10);
      const fiscalYear = requestedYear ?? fiscalYearOf(today, startMonth);
      const [from, to] = fiscalYearRange(fiscalYear, startMonth);
      const facts = await factsOf(tx, [relationshipId], true);
      const counted = facts.filter((fact) => !fact.excluded && fact.effectType);
      const inYear = (month: string) => month >= from && month < to;
      const securedOf = (fact: InitiativeFacts) =>
        fact.realizedValues
          .filter((value) => inYear(value.month))
          .reduce((sum, value) => sum + value.valueCents, 0);
      const steps = counted
        .filter((fact) => fact.effectType === 'ebit')
        .map((fact) => ({
          initiativeId: fact.id,
          title: fact.title,
          maturity: fact.maturity,
          securedCents: securedOf(fact),
        }))
        .filter((step) => step.securedCents !== 0)
        .sort((a, b) => b.securedCents - a.securedCents);
      const secured = securedIn(facts, from, to);
      // Ist-Monate im Geschäftsjahr, die das Controlling noch nicht freigegeben hat (nur EBIT)
      const pendingByFact = counted
        .filter((fact) => fact.effectType === 'ebit')
        .map((fact) => {
          const confirmed = new Set(fact.realizedValues.map((value) => value.month));
          return fact.values.filter(
            (value) =>
              value.kind === 'actual' && inYear(value.month) && !confirmed.has(value.month),
          );
        });
      const pendingValues = pendingByFact.flat();
      const others = (['cash', 'cost_avoidance', 'strategic'] as const)
        .map((effectType) => ({
          effectType,
          securedCents: counted
            .filter((fact) => fact.effectType === effectType)
            .reduce((sum, fact) => sum + securedOf(fact), 0),
        }))
        .filter((entry) => entry.securedCents !== 0);
      const [target] = await tx
        .select()
        .from(schema.relationshipEbitTarget)
        .where(
          and(
            eq(schema.relationshipEbitTarget.relationshipId, relationshipId),
            eq(schema.relationshipEbitTarget.year, fiscalYear),
          ),
        );
      const approvedTarget = target?.approvedAt ? target.ebitTargetCents : null;
      const pending = {
        months: new Set(pendingValues.map((value) => value.month)).size,
        initiatives: pendingByFact.filter((values) => values.length > 0).length,
        amountCents: pendingValues.reduce((sum, value) => sum + value.valueCents, 0),
      };
      const names = await supplierNames(tx, scope.orgId);
      const name = names.get(relationshipId) ?? '';
      const source = 'Impact-Ledger, vom Controlling bestätigt';
      const [top] = steps;
      const statementFacts: InsightFact[] = [
        { key: 'name', label: 'Lieferant', display: name, source: 'Lieferant' },
        { key: 'secured', label: 'Gesichert EBIT', display: money(secured), source },
        {
          key: 'initiatives',
          label: 'Initiativen mit bestätigtem Beitrag',
          display: String(steps.length),
          source,
        },
      ];
      if (top) {
        statementFacts.push(
          { key: 'top', label: 'Größter Beitrag', display: top.title, source },
          { key: 'topAmount', label: 'Beitrag', display: money(top.securedCents), source },
        );
      }
      if (approvedTarget) {
        statementFacts.push(
          { key: 'target', label: `Ziel ${fiscalYear}`, display: money(approvedTarget), source },
          {
            key: 'share',
            label: 'Anteil am Ziel',
            display: percent(secured / approvedTarget),
            source,
          },
        );
      }
      if (pending.months > 0) {
        statementFacts.push({
          key: 'pending',
          label: 'Monate ohne Bestätigung',
          display: String(pending.months),
          source: 'Controlling-Freigaben',
        });
      }
      // Ohne bestätigten Beitrag keine Aussage: die Seite zeigt nur den Beleg
      const insight =
        steps.length === 0
          ? { statement: null }
          : await this.summaries.summarize(tx, auth, {
              pageKey: 'supplier_results',
              scopeType: 'relationship',
              scopeId: relationshipId,
              period: String(fiscalYear),
              facts: statementFacts,
              fallback: {
                headline: approvedTarget
                  ? `Mit ${name} sind ${percent(secured / approvedTarget)} des Ziels gesichert.`
                  : `Mit ${name} sind ${money(secured)} EBIT gesichert.`,
                body: [
                  ...(top
                    ? [`Den größten Beitrag liefert ${top.title} mit ${money(top.securedCents)}.`]
                    : []),
                  ...(pending.months > 0
                    ? [
                        `${pending.months} Monate warten noch auf die Bestätigung durch das Controlling.`,
                      ]
                    : []),
                ].join(' '),
              },
              knownNames: [...names.values()],
            });
      return securedResultsSchema.parse({
        fiscalYear,
        fiscalYears: fiscalYearsOf(facts, startMonth, fiscalYear),
        currency: 'EUR',
        steps,
        securedEbitCents: secured,
        target: target
          ? { ebitTargetCents: target.ebitTargetCents, approved: target.approvedAt !== null }
          : null,
        pending,
        others,
        statement: insight.statement,
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
        .set({ approvedBy: auth.userId, approvedAt: currentTime() })
        .where(
          and(
            eq(schema.relationshipEbitTarget.relationshipId, relationshipId),
            eq(schema.relationshipEbitTarget.year, year),
          ),
        );
    });
  }
}
