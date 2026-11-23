import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  schema,
  seedMaterialGroupDefaults,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type AnalysisViewKey,
  analysisStepOf,
  type DueItem,
  defaultObjectiveCategories,
  type GoalRequest,
  goalDimensions,
  goalRequestSchema,
  type KpiRequest,
  kpiListSchema,
  kpiRequestSchema,
  type MilestoneRequest,
  portalKpiSource,
  questionListSchema,
  type SaveNote,
  type StepState,
  type StrategyContext,
  type StrategyContextResponse,
  type StrategyOverview,
  type StrategyRole,
  type StrategyStep,
  type StrategySummary,
  saveNoteSchema,
  strategyContextResponseSchema,
  strategyOverviewSchema,
  strategyStepSchema,
  strategySteps,
  strategyYearOf,
  swotTypes,
} from '@reziproq/shared';
import { type AccountOrganization, TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { analysisStates } from './analysis-states.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

type GroupRow = typeof schema.materialGroup.$inferSelect;
type StrategyRow = typeof schema.materialGroupStrategy.$inferSelect;

const allSteps = strategySteps.map((entry) => entry.step as number);
/** Lead und Commodity Manager alle Schritte, Einkauf im Team die Schritte 2 bis 9 (WG-04) */
const stepsFor = (role: StrategyRole): number[] =>
  role === 'lead' || role === 'commodity_manager'
    ? allSteps
    : role === 'buyer'
      ? allSteps.filter((step) => step >= 2 && step <= 9)
      : [];
/** Entwürfe lesen nur das Team und Admins; freigegebene alle Käufer */
const seesDraft = (role: StrategyRole) => role !== 'reader';

const toNumber = (value: string | null) => (value === null ? null : Number(value));

/**
 * WG-04, WG-06: Warengruppenstrategie je Jahr. Der Stand je Schritt ergibt sich aus den Daten; nur
 * „Zur Freigabe vorlegen“ (WG-16) wird ihn später verlangen. Leitfragen und Kennzahlen kommen beim
 * ersten Aufruf aus den Startdaten (WG-startdaten.md) und sind danach je Kunde änderbar.
 */
@Injectable()
export class StrategyService {
  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private organization(auth: AuthContext): AccountOrganization {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return organization;
  }

  private run<T>(
    auth: AuthContext,
    work: (tx: TenantTransaction, org: AccountOrganization) => Promise<T>,
  ) {
    const organization = this.organization(auth);
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, (tx) =>
      work(tx, organization),
    );
  }

  private async group(tx: TenantTransaction, id: string): Promise<GroupRow> {
    const [row] = await tx
      .select()
      .from(schema.materialGroup)
      .where(eq(schema.materialGroup.id, id));
    if (!row) throw notFound();
    return row;
  }

  private async strategy(tx: TenantTransaction, id: string): Promise<StrategyRow> {
    const [row] = await tx
      .select()
      .from(schema.materialGroupStrategy)
      .where(eq(schema.materialGroupStrategy.id, id));
    if (!row) throw notFound();
    return row;
  }

  /** Rolle in der Warengruppe: Felder der Warengruppe, dann das Team, dann Admin oder Leser. */
  private async roleOf(
    tx: TenantTransaction,
    auth: AuthContext,
    group: GroupRow,
  ): Promise<StrategyRole> {
    if (group.leadUserId === auth.userId) return 'lead';
    if (group.commodityManagerUserId === auth.userId) return 'commodity_manager';
    const roles = await tx
      .select({ role: schema.materialGroupMember.role })
      .from(schema.materialGroupMember)
      .where(
        and(
          eq(schema.materialGroupMember.materialGroupId, group.id),
          eq(schema.materialGroupMember.userId, auth.userId),
        ),
      );
    for (const role of ['lead', 'commodity_manager', 'buyer', 'function'] as const) {
      if (roles.some((row) => row.role === role)) return role;
    }
    return auth.orgRole === 'admin' ? 'admin' : 'reader';
  }

  /** Bearbeiten nur mit Recht und in der eigenen Rolle; freigegebene Strategien bleiben gesperrt. */
  private editable(auth: AuthContext, role: StrategyRole, strategy: StrategyRow): number[] {
    if (!can(auth, 'warengruppenstrategie.bearbeiten') || strategy.status === 'approved') return [];
    return stepsFor(role);
  }

  private async requireStep(
    tx: TenantTransaction,
    auth: AuthContext,
    strategyId: string,
    step: number,
  ) {
    const strategy = await this.strategy(tx, strategyId);
    const group = await this.group(tx, strategy.materialGroupId);
    const role = await this.roleOf(tx, auth, group);
    if (!this.editable(auth, role, strategy).includes(step)) throw forbidden();
    return { strategy, group };
  }

  /** Nach dem Vorlegen merkt sich die Strategie, dass sich seitdem etwas geändert hat (WG-16). */
  private async touched(tx: TenantTransaction, strategy: StrategyRow) {
    if (strategy.lastSubmittedAt && !strategy.changedSinceSubmission) {
      await tx
        .update(schema.materialGroupStrategy)
        .set({ changedSinceSubmission: true })
        .where(eq(schema.materialGroupStrategy.id, strategy.id));
    }
  }

  /** Stand je Schritt nach „Fertig, wenn“ der jeweiligen Spec */
  private async states(
    tx: TenantTransaction,
    strategy: StrategyRow,
    group: GroupRow,
  ): Promise<StepState[]> {
    const notes = await tx
      .select({
        step: schema.materialGroupNote.step,
        view: schema.materialGroupNote.view,
        text: schema.materialGroupNote.text,
        notApplicable: schema.materialGroupNote.notApplicable,
      })
      .from(schema.materialGroupNote)
      .where(eq(schema.materialGroupNote.strategyId, strategy.id));
    const noteFilled = (step: number) =>
      notes.some((note) => note.step === step && note.view === '' && note.text.trim().length > 0);
    const anyNote = (step: number) => notes.some((note) => note.step === step && note.text.trim());
    const [productGroups] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.materialGroupProductGroup)
      .where(eq(schema.materialGroupProductGroup.materialGroupId, group.id));
    const goals = await tx
      .select({ dimension: schema.materialGroupKpi.dimension })
      .from(schema.materialGroupGoal)
      .innerJoin(
        schema.materialGroupKpi,
        eq(schema.materialGroupKpi.id, schema.materialGroupGoal.kpiId),
      )
      .where(eq(schema.materialGroupGoal.strategyId, strategy.id));
    const analysis = await analysisStates(tx, strategy.id, group.id, notes);
    const swot = await tx
      .select({
        type: schema.materialGroupSwotItem.type,
        status: schema.materialGroupSwotItem.status,
      })
      .from(schema.materialGroupSwotItem)
      .where(eq(schema.materialGroupSwotItem.strategyId, strategy.id));
    const [choiceCount] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.materialGroupLeverChoice)
      .where(
        and(
          eq(schema.materialGroupLeverChoice.strategyId, strategy.id),
          eq(schema.materialGroupLeverChoice.status, 'chosen'),
        ),
      );
    const chosen = choiceCount?.n ?? 0;
    // WG-12: Initiativen je gewähltem Hebel für Schritt 7
    const chosenIds = await tx
      .select({ id: schema.materialGroupLeverChoice.id })
      .from(schema.materialGroupLeverChoice)
      .where(
        and(
          eq(schema.materialGroupLeverChoice.strategyId, strategy.id),
          eq(schema.materialGroupLeverChoice.status, 'chosen'),
        ),
      );
    const initiatives = await tx
      .select({
        leverChoiceId: schema.materialGroupInitiative.leverChoiceId,
        effect: schema.materialGroupInitiative.effect,
        ownerUserId: schema.materialGroupInitiative.ownerUserId,
        targetQuarter: schema.materialGroupInitiative.targetQuarter,
        targetYear: schema.materialGroupInitiative.targetYear,
      })
      .from(schema.materialGroupInitiative)
      .where(eq(schema.materialGroupInitiative.strategyId, strategy.id));
    const forces = await tx
      .select({ status: schema.materialGroupMarketForce.status })
      .from(schema.materialGroupMarketForce)
      .where(eq(schema.materialGroupMarketForce.strategyId, strategy.id));
    const hasLead = group.leadUserId !== null;
    const hasProducts = (productGroups?.n ?? 0) > 0;
    return strategySteps.map(({ step }): StepState => {
      if (step === 1) {
        // WG-04: Lead und mindestens eine Produktgruppe (WG-01)
        if (hasLead && hasProducts) return 'done';
        return hasLead || hasProducts || anyNote(1) ? 'in_progress' : 'open';
      }
      if (step === 2) {
        // WG-06: jede Dimension hat ein Ziel oder ist zurückgestellt, und die Begründung steht
        const covered = goalDimensions.every((dimension) =>
          goals.some((goal) => goal.dimension === dimension),
        );
        if (covered && noteFilled(2)) return 'done';
        return goals.length > 0 || anyNote(2) ? 'in_progress' : 'open';
      }
      if (step === 10) return strategy.status === 'approved' ? 'done' : 'open';
      // WG-07: Schritte 3 und 4 sind fertig, wenn alle Sichten fertig sind; Schritt 4 verlangt
      // zusätzlich die entschiedene Bewertungsrunde der Warengruppe (WG-18).
      if (step === 5) {
        // WG-09: alle sechs Kräfte bestätigt und die Zusammenschau ausgefüllt
        const confirmed = forces.filter((force) => force.status === 'confirmed').length;
        if (confirmed === 6 && noteFilled(5)) return 'done';
        return forces.length > 0 || anyNote(5) ? 'in_progress' : 'open';
      }
      if (step === 6) {
        // WG-10: je Feld ein bestätigter Eintrag und eine Paarung mit gewähltem Hebel
        const covered = swotTypes.every((type) =>
          swot.some((item) => item.type === type && item.status === 'confirmed'),
        );
        if (covered && chosen > 0) return 'done';
        return swot.length > 0 || anyNote(6) ? 'in_progress' : 'open';
      }
      if (step === 7) {
        // WG-12: jeder gewählte Hebel hat eine Initiative mit Effekt, Verantwortung und Termin
        const complete = (choiceId: string) =>
          initiatives.some(
            (entry) =>
              entry.leverChoiceId === choiceId &&
              entry.effect.trim().length > 0 &&
              entry.ownerUserId !== null &&
              entry.targetQuarter !== null &&
              entry.targetYear !== null,
          );
        if (chosenIds.length > 0 && chosenIds.every((choice) => complete(choice.id))) return 'done';
        return initiatives.length > 0 || anyNote(7) ? 'in_progress' : 'open';
      }
      if (step === 3) return analysis.step3;
      if (step === 4) return analysis.step4;
      // Schritte 3 bis 9: bis ihre Specs (WG-07 ff.) gebaut sind, zählt „Beobachtung und Erklärung“.
      return noteFilled(step) ? 'done' : anyNote(step) ? 'in_progress' : 'open';
    });
  }

  private async summary(
    tx: TenantTransaction,
    strategy: StrategyRow,
    group: GroupRow,
  ): Promise<StrategySummary> {
    return {
      id: strategy.id,
      year: strategy.year,
      status: strategy.status,
      version: strategy.version,
      steps: await this.states(tx, strategy, group),
    };
  }

  /** Umsatz je Warengruppe im letzten Jahr mit Ist-Spend, Zahl der Lieferanten, Name des Leads */
  private async facts(tx: TenantTransaction, orgId: string) {
    const spend = await tx.execute<{
      material_group_id: string;
      year: number;
      amount: number;
      currency: string;
    }>(sql`
      select distinct on (s.material_group_id) s.material_group_id, s.year,
        sum(s.amount_cents) over (partition by s.material_group_id, s.year)::bigint as amount, s.currency
      from relationship_spend s
      join relationship r on r.id = s.relationship_id
      where r.buyer_org_id = ${orgId} and s.kind = 'actual' and s.material_group_id is not null
      order by s.material_group_id, s.year desc
    `);
    const suppliers = await tx.execute<{ material_group_id: string; n: number }>(sql`
      select material_group_id, count(*)::int as n from relationship_material_group group by material_group_id
    `);
    const people = await tx
      .select({ id: schema.appUser.id, name: schema.appUser.name })
      .from(schema.appUser)
      .where(eq(schema.appUser.organizationId, orgId));
    return {
      spendOf: (groupId: string) => {
        const row = spend.rows.find((entry) => entry.material_group_id === groupId);
        return row
          ? { amountCents: Number(row.amount), currency: row.currency, year: row.year }
          : null;
      },
      suppliersOf: (groupId: string) =>
        suppliers.rows.find((entry) => entry.material_group_id === groupId)?.n ?? 0,
      personOf: (userId: string | null) =>
        userId
          ? { userId, name: people.find((person) => person.id === userId)?.name ?? userId }
          : null,
    };
  }

  private async latest(tx: TenantTransaction, groupId: string, year: number) {
    const [row] = await tx
      .select()
      .from(schema.materialGroupStrategy)
      .where(
        and(
          eq(schema.materialGroupStrategy.materialGroupId, groupId),
          eq(schema.materialGroupStrategy.year, year),
        ),
      )
      .orderBy(desc(schema.materialGroupStrategy.version))
      .limit(1);
    return row ?? null;
  }

  /** Erster offene Schritt, den die Person bearbeiten darf */
  private nextStep(states: StepState[], editable: number[]) {
    return editable.find((step) => states[step - 1] !== 'done') ?? null;
  }

  overview(auth: AuthContext, year = strategyYearOf(new Date())): Promise<StrategyOverview> {
    return this.run(auth, async (tx, org) => {
      const groups = await tx
        .select()
        .from(schema.materialGroup)
        .where(eq(schema.materialGroup.active, true))
        .orderBy(asc(schema.materialGroup.name));
      const facts = await this.facts(tx, org.id);
      let next: StrategyOverview['next'] = null;
      let approvedCount = 0;
      const rows: StrategyOverview['groups'] = [];
      for (const group of groups) {
        const role = await this.roleOf(tx, auth, group);
        const strategy = await this.latest(tx, group.id, year);
        const visible = strategy && (seesDraft(role) || strategy.status === 'approved');
        const summary = visible ? await this.summary(tx, strategy, group) : null;
        if (strategy?.status === 'approved') approvedCount += 1;
        const canCreate =
          !strategy &&
          can(auth, 'warengruppenstrategie.bearbeiten') &&
          (role === 'lead' || role === 'commodity_manager');
        if (!next && canCreate)
          next = { materialGroupId: group.id, name: group.name, step: null, strategyId: null };
        if (!next && strategy && summary) {
          const step = this.nextStep(summary.steps, this.editable(auth, role, strategy));
          if (step)
            next = { materialGroupId: group.id, name: group.name, step, strategyId: strategy.id };
        }
        rows.push({
          id: group.id,
          name: group.name,
          code: group.code,
          lead: facts.personOf(group.leadUserId),
          spend: facts.spendOf(group.id),
          supplierCount: facts.suppliersOf(group.id),
          strategy: summary,
          hidden: Boolean(strategy) && !visible,
          canCreate,
        });
      }
      return strategyOverviewSchema.parse({ year, next, groups: rows, approvedCount });
    });
  }

  private async contextIn(
    tx: TenantTransaction,
    auth: AuthContext,
    org: AccountOrganization,
    group: GroupRow,
    strategy: StrategyRow,
  ): Promise<StrategyContext> {
    const facts = await this.facts(tx, org.id);
    const role = await this.roleOf(tx, auth, group);
    return {
      group: {
        id: group.id,
        name: group.name,
        code: group.code,
        lead: facts.personOf(group.leadUserId),
        spend: facts.spendOf(group.id),
        supplierCount: facts.suppliersOf(group.id),
      },
      strategy: await this.summary(tx, strategy, group),
      role,
      editableSteps: this.editable(auth, role, strategy),
    };
  }

  context(
    auth: AuthContext,
    groupId: string,
    year = strategyYearOf(new Date()),
  ): Promise<StrategyContextResponse> {
    return this.run(auth, async (tx, org) => {
      const group = await this.group(tx, groupId);
      const role = await this.roleOf(tx, auth, group);
      const strategy = await this.latest(tx, groupId, year);
      const visible = strategy && (seesDraft(role) || strategy.status === 'approved');
      return strategyContextResponseSchema.parse({
        year,
        context: visible ? await this.contextIn(tx, auth, org, group, strategy) : null,
        hidden: Boolean(strategy) && !visible,
        canCreate:
          !strategy &&
          group.active &&
          can(auth, 'warengruppenstrategie.bearbeiten') &&
          (role === 'lead' || role === 'commodity_manager'),
      });
    });
  }

  /** Genau eine Strategie je Warengruppe und Jahr; eine zweite wird abgelehnt (409). */
  create(auth: AuthContext, groupId: string, year: number): Promise<StrategyContextResponse> {
    if (!can(auth, 'warengruppenstrategie.bearbeiten')) throw forbidden();
    return this.run(auth, async (tx, org) => {
      const group = await this.group(tx, groupId);
      const role = await this.roleOf(tx, auth, group);
      if (role !== 'lead' && role !== 'commodity_manager') throw forbidden();
      if (!group.active) throw new ConflictException({ statusCode: 409, code: 'inactive' });
      if (await this.latest(tx, groupId, year)) {
        throw new ConflictException({
          statusCode: 409,
          code: 'strategy_exists',
          message: 'Für dieses Jahr gibt es schon eine Strategie.',
        });
      }
      await seedMaterialGroupDefaults(tx, org.id);
      const [created] = await tx
        .insert(schema.materialGroupStrategy)
        .values({ orgId: org.id, materialGroupId: groupId, year, createdBy: auth.userId })
        .returning();
      return strategyContextResponseSchema.parse({
        year,
        context: await this.contextIn(tx, auth, org, group, created as StrategyRow),
        hidden: false,
        canCreate: false,
      });
    }).catch((error: unknown) => {
      const cause = (error as { cause?: { code?: string } }).cause;
      if (cause?.code === '23505') {
        throw new ConflictException({ statusCode: 409, code: 'strategy_exists' });
      }
      throw error;
    });
  }

  /**
   * Zugriff für andere Teile der Strategie (WG-07 ff.): Strategie, Warengruppe, Rolle, bearbeitbare
   * Schritte. Wirft 404, wenn die Person den Entwurf nicht lesen darf.
   */
  async accessIn(tx: TenantTransaction, auth: AuthContext, strategyId: string) {
    const { strategy, group, role } = await this.readable(tx, auth, strategyId);
    return {
      strategy,
      group,
      role,
      editableSteps: this.editable(auth, role, strategy),
      // WG-07: Kostensicht nur für Lead, Commodity Manager, Einkauf im Team und Freigebende (heute
      // Admins), auch nach der Freigabe. Die Funktion im Team nie (Gründer, 23.11.2026).
      seesCost: role !== 'reader' && role !== 'function',
    };
  }

  /** Nach einer Änderung in einem Schritt (WG-16): merkt sich die Änderung seit dem Vorlegen. */
  async touchedIn(tx: TenantTransaction, strategy: StrategyRow) {
    await this.touched(tx, strategy);
  }

  /** Lesen eines Schritts: Entwürfe nur im Team und für Admins (WG-04). */
  private async readable(tx: TenantTransaction, auth: AuthContext, strategyId: string) {
    const strategy = await this.strategy(tx, strategyId);
    const group = await this.group(tx, strategy.materialGroupId);
    const role = await this.roleOf(tx, auth, group);
    if (strategy.status !== 'approved' && !seesDraft(role)) throw notFound();
    return { strategy, group, role };
  }

  private async dimensions(tx: TenantTransaction, orgId: string) {
    const categories = await tx
      .select({ key: schema.objectiveCategory.key, name: schema.objectiveCategory.name })
      .from(schema.objectiveCategory)
      .where(eq(schema.objectiveCategory.orgId, orgId));
    return goalDimensions.map((key) => ({
      key,
      name:
        categories.find((category) => category.key === key)?.name ??
        defaultObjectiveCategories.find((category) => category.key === key)?.name ??
        key,
    }));
  }

  private async stepIn(
    tx: TenantTransaction,
    org: AccountOrganization,
    strategy: StrategyRow,
    step: number,
  ) {
    await seedMaterialGroupDefaults(tx, org.id);
    const questions = await tx
      .select({
        id: schema.materialGroupQuestion.id,
        view: schema.materialGroupQuestion.view,
        text: schema.materialGroupQuestion.text,
      })
      .from(schema.materialGroupQuestion)
      .where(eq(schema.materialGroupQuestion.step, step))
      .orderBy(asc(schema.materialGroupQuestion.position));
    const notes = await tx
      .select()
      .from(schema.materialGroupNote)
      .where(
        and(
          eq(schema.materialGroupNote.strategyId, strategy.id),
          eq(schema.materialGroupNote.step, step),
        ),
      );
    const milestones =
      step === 1
        ? await tx
            .select({
              id: schema.materialGroupMilestone.id,
              title: schema.materialGroupMilestone.title,
              dueOn: schema.materialGroupMilestone.dueOn,
            })
            .from(schema.materialGroupMilestone)
            .where(eq(schema.materialGroupMilestone.strategyId, strategy.id))
            .orderBy(asc(schema.materialGroupMilestone.dueOn))
        : [];
    const leadSuggestion =
      step === 1 ? await this.leadSuggestion(tx, strategy.materialGroupId) : null;
    const goalStep = step === 2;
    const kpis = goalStep
      ? await tx.select().from(schema.materialGroupKpi).orderBy(asc(schema.materialGroupKpi.name))
      : [];
    const goals = goalStep
      ? await tx
          .select({ goal: schema.materialGroupGoal, dimension: schema.materialGroupKpi.dimension })
          .from(schema.materialGroupGoal)
          .innerJoin(
            schema.materialGroupKpi,
            eq(schema.materialGroupKpi.id, schema.materialGroupGoal.kpiId),
          )
          .where(eq(schema.materialGroupGoal.strategyId, strategy.id))
          .orderBy(asc(schema.materialGroupGoal.createdAt))
      : [];
    const portal = goalStep
      ? await this.portalActuals(tx, strategy.materialGroupId, kpis)
      : new Map<string, { value: number; asOf: string }>();
    return strategyStepSchema.parse({
      step,
      questions,
      notes: notes.map((note) => ({
        view: note.view,
        text: note.text,
        notApplicable: note.notApplicable,
        updatedAt: note.updatedAt.toISOString(),
      })),
      milestones,
      leadSuggestion,
      dimensions: goalStep ? await this.dimensions(tx, org.id) : [],
      kpis,
      goals: goals.map(({ goal, dimension }) => ({
        id: goal.id,
        kpiId: goal.kpiId,
        dimension,
        text: goal.text,
        ...(portal.has(goal.kpiId)
          ? {
              actual: portal.get(goal.kpiId)?.value ?? null,
              actualSource: 'portal' as const,
              actualAsOf: portal.get(goal.kpiId)?.asOf ?? null,
            }
          : { actual: toNumber(goal.actual), actualSource: 'manual' as const, actualAsOf: null }),
        targetNextYear: toNumber(goal.targetNextYear),
        targetFinal: toNumber(goal.targetFinal),
        targetQuarter: goal.targetQuarter,
        targetYear: goal.targetYear,
        deferred: goal.deferred,
        deferredReason: goal.deferredReason,
      })),
    });
  }

  /**
   * WG-06: Ist-Werte aus dem Portal. Für Kennzahlen mit Quelle „scorecard“ der Mittelwert der
   * jüngsten Werte gleichnamiger Scorecard-Kennzahlen bei den Lieferanten der Warengruppe, gelesen
   * unter der Session der Person (Zeilensicherheit). Berechnet beim Lesen, also nie älter als der
   * letzte eingetragene Monat; ohne Wert bleibt der Ist-Wert von Hand.
   */
  private async portalActuals(
    tx: TenantTransaction,
    groupId: string,
    kpis: { id: string; name: string; source: string | null }[],
  ) {
    const result = new Map<string, { value: number; asOf: string }>();
    for (const kpi of kpis.filter((entry) => entry.source === portalKpiSource)) {
      const rows = await tx.execute<{ value: string | null; as_of: string | null }>(sql`
        with latest as (
          select distinct on (k.id) v.value, v.period
          from scorecard_kpi k
          join kpi_value v on v.kpi_id = k.id
          join relationship_material_group m on m.relationship_id = k.relationship_id
          where m.material_group_id = ${groupId}
            and lower(trim(k.name)) = lower(trim(${kpi.name}))
          order by k.id, v.period desc, v.entered_at desc
        )
        select round(avg(value), 4)::text as value, max(period)::text as as_of from latest`);
      const [row] = rows.rows;
      if (row?.value && row.as_of)
        result.set(kpi.id, { value: Number(row.value), asOf: row.as_of });
    }
    return result;
  }

  /** WG-04: Einkauf im Team aus der Business Unit mit dem höchsten Umsatz dieser Warengruppe */
  private async leadSuggestion(tx: TenantTransaction, groupId: string) {
    const group = await this.group(tx, groupId);
    const result = await tx.execute<{ user_id: string; name: string; unit: string }>(sql`
      with top as (
        select s.business_unit_id, sum(s.amount_cents) as amount
        from relationship_spend s
        where s.material_group_id = ${groupId} and s.business_unit_id is not null and s.kind = 'actual'
        group by s.business_unit_id
        order by amount desc
        limit 1
      )
      select m.user_id, u.name, b.name as unit
      from top
      join material_group_member m on m.material_group_id = ${groupId}
        and m.business_unit_id = top.business_unit_id and m.role = 'buyer'
      join app_user u on u.id = m.user_id
      join business_unit b on b.id = top.business_unit_id
      order by u.name
      limit 1
    `);
    const row = result.rows[0];
    if (!row || row.user_id === group.leadUserId) return null;
    return { userId: row.user_id, name: row.name, businessUnit: row.unit };
  }

  step(auth: AuthContext, strategyId: string, step: number): Promise<StrategyStep> {
    return this.run(auth, async (tx, org) => {
      const { strategy, role } = await this.readable(tx, auth, strategyId);
      const content = await this.stepIn(tx, org, strategy, step);
      // WG-07: Die Beobachtung zur Kostensicht sieht nur das Team.
      return role === 'reader'
        ? { ...content, notes: content.notes.filter((note) => note.view !== 'cost') }
        : content;
    });
  }

  saveNote(
    auth: AuthContext,
    strategyId: string,
    step: number,
    input: SaveNote,
  ): Promise<StrategyStep> {
    const note = saveNoteSchema.parse(input);
    return this.run(auth, async (tx, org) => {
      const { strategy } = await this.requireStep(tx, auth, strategyId, step);
      await tx
        .insert(schema.materialGroupNote)
        .values({
          orgId: org.id,
          strategyId,
          step,
          view: note.view,
          text: note.text,
          notApplicable: note.notApplicable,
          updatedBy: auth.userId,
        })
        .onConflictDoUpdate({
          target: [
            schema.materialGroupNote.strategyId,
            schema.materialGroupNote.step,
            schema.materialGroupNote.view,
          ],
          set: {
            text: note.text,
            notApplicable: note.notApplicable,
            updatedBy: auth.userId,
            updatedAt: new Date(),
          },
        });
      await this.touched(tx, strategy);
      return this.stepIn(tx, org, strategy, step);
    });
  }

  addMilestone(
    auth: AuthContext,
    strategyId: string,
    input: MilestoneRequest,
  ): Promise<StrategyStep> {
    return this.run(auth, async (tx, org) => {
      const { strategy } = await this.requireStep(tx, auth, strategyId, 1);
      await tx
        .insert(schema.materialGroupMilestone)
        .values({ orgId: org.id, strategyId, title: input.title, dueOn: input.dueOn });
      await this.touched(tx, strategy);
      return this.stepIn(tx, org, strategy, 1);
    });
  }

  removeMilestone(
    auth: AuthContext,
    strategyId: string,
    milestoneId: string,
  ): Promise<StrategyStep> {
    return this.run(auth, async (tx, org) => {
      const { strategy } = await this.requireStep(tx, auth, strategyId, 1);
      const deleted = await tx
        .delete(schema.materialGroupMilestone)
        .where(
          and(
            eq(schema.materialGroupMilestone.id, milestoneId),
            eq(schema.materialGroupMilestone.strategyId, strategyId),
          ),
        )
        .returning({ id: schema.materialGroupMilestone.id });
      if (deleted.length === 0) throw notFound();
      return this.stepIn(tx, org, strategy, 1);
    });
  }

  private goalValues(input: GoalRequest) {
    const parsed = goalRequestSchema.safeParse(input);
    if (!parsed.success) {
      throw new BadRequestException({
        code: parsed.error.issues[0]?.message ?? 'invalid',
        message: 'Ungültige Eingabe',
      });
    }
    const goal = parsed.data;
    const decimal = (value: number | null | undefined) => (value == null ? null : String(value));
    return {
      kpiId: goal.kpiId,
      text: goal.text,
      // Ohne Angabe bleibt der Ist-Wert, wie er ist (Ist aus dem Portal wird nicht überschrieben)
      actual: goal.actual === undefined ? undefined : decimal(goal.actual),
      targetNextYear: decimal(goal.targetNextYear),
      targetFinal: decimal(goal.targetFinal),
      targetQuarter: goal.targetQuarter ?? null,
      targetYear: goal.targetYear ?? null,
      deferred: goal.deferred,
      deferredReason: goal.deferred ? (goal.deferredReason ?? null) : null,
    };
  }

  /** Die Kennzahl muss es geben und aktiv sein; sie bestimmt die Dimension. */
  private async requireKpi(tx: TenantTransaction, kpiId: string) {
    const [kpi] = await tx
      .select({ active: schema.materialGroupKpi.active })
      .from(schema.materialGroupKpi)
      .where(eq(schema.materialGroupKpi.id, kpiId));
    if (!kpi?.active)
      throw new BadRequestException({ code: 'kpi_required', message: 'Ungültige Kennzahl' });
  }

  addGoal(auth: AuthContext, strategyId: string, input: GoalRequest): Promise<StrategyStep> {
    const values = this.goalValues(input);
    return this.run(auth, async (tx, org) => {
      const { strategy } = await this.requireStep(tx, auth, strategyId, 2);
      await this.requireKpi(tx, values.kpiId);
      await tx.insert(schema.materialGroupGoal).values({ ...values, orgId: org.id, strategyId });
      await this.touched(tx, strategy);
      return this.stepIn(tx, org, strategy, 2);
    });
  }

  updateGoal(
    auth: AuthContext,
    strategyId: string,
    goalId: string,
    input: GoalRequest,
  ): Promise<StrategyStep> {
    const values = this.goalValues(input);
    return this.run(auth, async (tx, org) => {
      const { strategy } = await this.requireStep(tx, auth, strategyId, 2);
      await this.requireKpi(tx, values.kpiId);
      const updated = await tx
        .update(schema.materialGroupGoal)
        .set(values)
        .where(
          and(
            eq(schema.materialGroupGoal.id, goalId),
            eq(schema.materialGroupGoal.strategyId, strategyId),
          ),
        )
        .returning({ id: schema.materialGroupGoal.id });
      if (updated.length === 0) throw notFound();
      await this.touched(tx, strategy);
      return this.stepIn(tx, org, strategy, 2);
    });
  }

  removeGoal(auth: AuthContext, strategyId: string, goalId: string): Promise<StrategyStep> {
    return this.run(auth, async (tx, org) => {
      const { strategy } = await this.requireStep(tx, auth, strategyId, 2);
      const deleted = await tx
        .delete(schema.materialGroupGoal)
        .where(
          and(
            eq(schema.materialGroupGoal.id, goalId),
            eq(schema.materialGroupGoal.strategyId, strategyId),
          ),
        )
        .returning({ id: schema.materialGroupGoal.id });
      if (deleted.length === 0) throw notFound();
      await this.touched(tx, strategy);
      return this.stepIn(tx, org, strategy, 2);
    });
  }

  /** Kennzahlen: alle Käufer lesen, Admins stellen ein (WG-06). */
  kpis(auth: AuthContext) {
    return this.run(auth, async (tx, org) => {
      await seedMaterialGroupDefaults(tx, org.id);
      const kpis = await tx
        .select()
        .from(schema.materialGroupKpi)
        .orderBy(asc(schema.materialGroupKpi.name));
      return kpiListSchema.parse({ dimensions: await this.dimensions(tx, org.id), kpis });
    });
  }

  saveKpi(auth: AuthContext, input: KpiRequest, id?: string) {
    if (!can(auth, 'stammdaten.verwalten')) throw forbidden();
    const kpi = kpiRequestSchema.parse(input);
    return this.run(auth, async (tx, org) => {
      const values = {
        dimension: kpi.dimension,
        name: kpi.name,
        description: kpi.description ?? null,
        unit: kpi.unit ?? null,
        source: kpi.source ?? null,
        active: kpi.active,
      };
      if (id) {
        const updated = await tx
          .update(schema.materialGroupKpi)
          .set(values)
          .where(eq(schema.materialGroupKpi.id, id))
          .returning({ id: schema.materialGroupKpi.id });
        if (updated.length === 0) throw notFound();
      } else {
        await tx.insert(schema.materialGroupKpi).values({ ...values, orgId: org.id });
      }
      const kpis = await tx
        .select()
        .from(schema.materialGroupKpi)
        .orderBy(asc(schema.materialGroupKpi.name));
      return kpiListSchema.parse({ dimensions: await this.dimensions(tx, org.id), kpis });
    }).catch((error: unknown) => {
      if ((error as { cause?: { code?: string } }).cause?.code === '23505') {
        throw new ConflictException({ statusCode: 409, code: 'name_taken' });
      }
      throw error;
    });
  }

  /** Leitfragen: alle Käufer lesen, Admins ändern den Text (WG-04). */
  questions(auth: AuthContext) {
    return this.run(auth, async (tx, org) => {
      await seedMaterialGroupDefaults(tx, org.id);
      const questions = await tx
        .select()
        .from(schema.materialGroupQuestion)
        .orderBy(
          asc(schema.materialGroupQuestion.step),
          asc(schema.materialGroupQuestion.position),
        );
      return questionListSchema.parse({
        questions: questions.map(({ id, step, view, text, position }) => ({
          id,
          step,
          view,
          text,
          position,
        })),
      });
    });
  }

  updateQuestion(auth: AuthContext, id: string, text: string) {
    if (!can(auth, 'stammdaten.verwalten')) throw forbidden();
    return this.run(auth, async (tx) => {
      const updated = await tx
        .update(schema.materialGroupQuestion)
        .set({ text })
        .where(eq(schema.materialGroupQuestion.id, id))
        .returning({ id: schema.materialGroupQuestion.id });
      if (updated.length === 0) throw notFound();
    }).then(() => this.questions(auth));
  }

  /** Start (NAV-05): der nächste offene Schritt je Strategie im Entwurf, den die Person bearbeitet. */
  async dueItems(auth: AuthContext): Promise<DueItem[]> {
    if (!auth.organization?.buyer) return [];
    const assigned = can(auth, 'warengruppen.sehen')
      ? [...(await this.assignedViews(auth)), ...(await this.openReviews(auth))]
      : [];
    if (!can(auth, 'warengruppenstrategie.bearbeiten')) return assigned;
    return [...assigned, ...(await this.openSteps(auth))];
  }

  /**
   * WG-07 (Schritt 24): zugewiesene Sichten im Entwurf, zu denen die Person noch nichts
   * kommentiert hat; fällig zum nächsten Meilenstein, sonst zum Jahresende vor dem Strategiejahr.
   */
  private assignedViews(auth: AuthContext): Promise<DueItem[]> {
    return this.run(auth, async (tx) => {
      const rows = await tx.execute<{
        strategy_id: string;
        view: string;
        group_id: string;
        group_name: string;
        year: number;
        due_on: string | null;
      }>(sql`
        select a.strategy_id, a.view, g.id as group_id, g.name as group_name, s.year,
          (select min(m.due_on)::text from material_group_milestone m where m.strategy_id = s.id) as due_on
        from material_group_view_assignment a
        join material_group_strategy s on s.id = a.strategy_id
        join material_group g on g.id = s.material_group_id
        where a.user_id = ${auth.userId} and s.status in ('draft', 'resubmit') and g.active
          and not exists (select 1 from material_group_view_comment c
            where c.strategy_id = a.strategy_id and c.view = a.view and c.author_user_id = ${auth.userId})
        order by g.name, a.view`);
      return rows.rows.map((row) => {
        const step = analysisStepOf(row.view as AnalysisViewKey);
        return {
          id: `${row.strategy_id}:${row.view}`,
          kind: 'view_assignment' as const,
          supplier: row.group_name,
          detail: row.view,
          dueDate: row.due_on ?? `${row.year - 1}-12-31`,
          href: `/warengruppen/${row.group_id}/strategie/${step}`,
        };
      });
    });
  }

  /** WG-12: offene Quartals-Reviews der Warengruppen, deren Lead die Person ist */
  private openReviews(auth: AuthContext): Promise<DueItem[]> {
    return this.run(auth, async (tx) => {
      const rows = await tx
        .select({
          id: schema.materialGroupReview.id,
          dueOn: schema.materialGroupReview.dueOn,
          groupId: schema.materialGroup.id,
          groupName: schema.materialGroup.name,
        })
        .from(schema.materialGroupReview)
        .innerJoin(
          schema.materialGroupStrategy,
          eq(schema.materialGroupStrategy.id, schema.materialGroupReview.strategyId),
        )
        .innerJoin(
          schema.materialGroup,
          eq(schema.materialGroup.id, schema.materialGroupStrategy.materialGroupId),
        )
        .where(
          and(
            isNull(schema.materialGroupReview.heldAt),
            eq(schema.materialGroup.leadUserId, auth.userId),
          ),
        )
        .orderBy(asc(schema.materialGroupReview.dueOn));
      return rows.map((row) => ({
        id: `review:${row.id}`,
        kind: 'category_review' as const,
        supplier: row.groupName,
        detail: row.dueOn,
        dueDate: row.dueOn,
        href: `/warengruppen/${row.groupId}/review/${row.id}`,
      }));
    });
  }

  private openSteps(auth: AuthContext): Promise<DueItem[]> {
    return this.run(auth, async (tx) => {
      const strategies = await tx
        .select()
        .from(schema.materialGroupStrategy)
        .where(inArray(schema.materialGroupStrategy.status, ['draft', 'resubmit']));
      const items: DueItem[] = [];
      for (const strategy of strategies) {
        const group = await this.group(tx, strategy.materialGroupId);
        if (!group.active) continue;
        const role = await this.roleOf(tx, auth, group);
        const editable = this.editable(auth, role, strategy);
        if (editable.length === 0) continue;
        const step = this.nextStep(await this.states(tx, strategy, group), editable);
        if (!step) continue;
        const [milestone] = await tx
          .select({ dueOn: schema.materialGroupMilestone.dueOn })
          .from(schema.materialGroupMilestone)
          .where(eq(schema.materialGroupMilestone.strategyId, strategy.id))
          .orderBy(asc(schema.materialGroupMilestone.dueOn))
          .limit(1);
        items.push({
          id: `${strategy.id}:${step}`,
          kind: 'strategy',
          supplier: group.name,
          detail: String(step),
          // Ohne Meilenstein: bis zum Jahresende vor dem Strategiejahr
          dueDate: milestone?.dueOn ?? `${strategy.year - 1}-12-31`,
          href: `/warengruppen/${group.id}/strategie/${step}`,
        });
      }
      return items;
    });
  }
}
