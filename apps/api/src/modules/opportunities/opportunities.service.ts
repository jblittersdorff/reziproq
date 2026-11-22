import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  auditedChange,
  desc,
  eq,
  inArray,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type AdoptOpportunity,
  type ChangeAssumptions,
  displayNameOf,
  type OpportunityImpactType,
  type OpportunityInput,
  type SendDataRequest,
  type ValueAssumption,
  type OpportunityTemplateKey,
  opportunityImpactTypes,
  opportunityInputSchema,
  opportunityTemplateKeys,
  type ValueOpportunities,
  valueOpportunitiesSchema,
} from '@reziproq/shared';
import { generateText } from 'ai';
import { TenantDatabase } from '../../common/database.module.js';
import { env } from '../../config/env.js';
import { readAiSettings } from '../ai-gateway/ai-settings.js';
import { BudgetExhaustedError } from '../ai-gateway/gateway-errors.js';
import { estimateTokens, ModelGateway } from '../ai-gateway/model-gateway.js';
import { actorOf } from '../audit/actor.js';
import { valueOpportunityAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { ActionsService } from '../actions/actions.service.js';
import { type JbpScope, JbpService } from '../jbp/jbp.service.js';
import { JbpTopicsService } from '../jbp/jbp-topics.service.js';
import {
  calculateOpportunities,
  calculateOpportunity,
  templateFields,
  templateVersion,
} from './calculation.js';
import {
  datedSources,
  fakeMarketFindings,
  type MarketFinding,
  privateNumbers,
  queryAllowed,
  reasonAllowed,
} from './market.js';
import {
  dataGapDescriptions,
  templateAssumptions,
  templateShareText,
  templateSupplierEffect,
  templateTitles,
} from './templates.js';
import { syncRealized } from './realized.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

/** Systemagent des Wertpotenzial-Finders; Versionsnummer erhöhen, wenn sich Ablauf oder Werkzeuge ändern. */
export const valueFinder = {
  key: 'value_finder',
  version: 1,
  name: 'Wertpotenziale',
  description:
    'Findet je Lieferant gemeinsame Wertpotenziale und beziffert sie nach Hebel-Vorlagen.',
  instructions:
    'Wähle Hebel-Vorlagen, hole Eingaben über Werkzeuge und begründe kurz. Zahlen rechnet nur der Code.',
  tools: ['spend', 'hebel_vorlagen', 'web_search', 'fetch_source'],
  outputTarget: 'value_opportunity',
  reviewerRule: 'sro',
  modelClass: 'standard',
  budgetCents: 200,
  maxSteps: 60,
  trigger: 'manual',
} as const;

/** Schritte des Laufs (KI-11): Plan, lesen, recherchieren, rechnen, begründen, ablegen */
const runSteps = [
  { seq: 1, kind: 'plan', title: 'plan' },
  { seq: 2, kind: 'read', title: 'read' },
  { seq: 3, kind: 'search', title: 'search' },
  { seq: 4, kind: 'check', title: 'check' },
  { seq: 5, kind: 'model', title: 'model' },
  { seq: 6, kind: 'draft', title: 'draft' },
] as const;

/** Welche Eingaben einer Vorlage aus welcher Signalart kommen */
const publicInputs: Partial<Record<OpportunityTemplateKey, MarketFinding['kind']>> = {
  index_clause: 'raw_material',
  tariffs: 'tariff_regulation',
};

const signalReasons = {
  opportunity: 'Fließt in ein Potenzial nach Vorlage.',
  topic: 'Kein Hebel beziffert das; als Thema ohne Euro vorgeschlagen.',
  data_gap: 'Für die Rechnung fehlt eine eigene Eingabe.',
  no_effect: 'Betrifft keinen Hebel der Beziehung.',
} as const;

type OpportunityRow = typeof schema.valueOpportunity.$inferSelect;
type Results = Awaited<ReturnType<typeof calculateOpportunities>>;

const isoDate = () => new Date().toISOString().slice(0, 10);
const euros = (cents: number) => Math.round(cents / 100);

/**
 * KI-11: Wertpotenzial-Finder. Der Lauf liest eigene Daten, holt Marktsignale nur mit
 * öffentlicher Recherche, rechnet jede Vorlage im Code und lässt das Modell nur begründen.
 * Alles bleibt org_private; der Lieferant sieht nur Themen, die der SRO daraus anlegt.
 */
@Injectable()
export class OpportunitiesService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(JbpService) private readonly jbp: JbpService,
    @Inject(JbpTopicsService) private readonly topics: JbpTopicsService,
    @Inject(ModelGateway) private readonly gateway: ModelGateway,
    @Inject(ActionsService) private readonly actions: ActionsService,
  ) {}

  private scope<T>(
    auth: AuthContext,
    relationshipId: string,
    work: (scope: JbpScope) => Promise<T>,
  ) {
    if (!auth.organization?.buyer || !can(auth, 'wirkung.sehen')) throw forbidden();
    return this.jbp.buyer(auth, relationshipId, work);
  }

  /** Lauf starten, Annahmen ändern, übernehmen, verwerfen: SRO der Beziehung oder Admin */
  private canDecide(scope: JbpScope) {
    return (
      !scope.auth.supportOrganization &&
      (scope.auth.orgRole === 'admin' || scope.teamRole === 'sro')
    );
  }

  private async agentVersion(tx: TenantTransaction, orgId: string) {
    await tx
      .insert(schema.agent)
      .values({
        orgId,
        key: valueFinder.key,
        name: valueFinder.name,
        description: valueFinder.description,
        kind: 'system',
        status: 'active',
      })
      .onConflictDoNothing({ target: [schema.agent.orgId, schema.agent.key] });
    const [instance] = await tx
      .select({ id: schema.agent.id })
      .from(schema.agent)
      .where(and(eq(schema.agent.orgId, orgId), eq(schema.agent.key, valueFinder.key)));
    if (!instance) throw notFound();
    await tx
      .insert(schema.agentVersion)
      .values({
        orgId,
        agentId: instance.id,
        version: valueFinder.version,
        instructions: valueFinder.instructions,
        tools: [...valueFinder.tools],
        trigger: valueFinder.trigger,
        outputTarget: valueFinder.outputTarget,
        reviewerRule: valueFinder.reviewerRule,
        modelClass: valueFinder.modelClass,
        budgetCents: valueFinder.budgetCents,
        maxSteps: valueFinder.maxSteps,
      })
      .onConflictDoNothing({
        target: [
          schema.agentVersion.orgId,
          schema.agentVersion.agentId,
          schema.agentVersion.version,
        ],
      });
    const [version] = await tx
      .select({ id: schema.agentVersion.id })
      .from(schema.agentVersion)
      .where(
        and(
          eq(schema.agentVersion.orgId, orgId),
          eq(schema.agentVersion.agentId, instance.id),
          eq(schema.agentVersion.version, valueFinder.version),
        ),
      );
    if (!version) throw notFound();
    return version.id;
  }

  private async lastRun(tx: TenantTransaction, orgId: string, relationshipId: string) {
    const [row] = await tx
      .select({ run: schema.agentRun })
      .from(schema.agentRun)
      .innerJoin(
        schema.agentVersion,
        and(
          eq(schema.agentVersion.orgId, schema.agentRun.orgId),
          eq(schema.agentVersion.id, schema.agentRun.agentVersionId),
        ),
      )
      .innerJoin(
        schema.agent,
        and(
          eq(schema.agent.orgId, schema.agentRun.orgId),
          eq(schema.agent.id, schema.agentVersion.agentId),
        ),
      )
      .where(
        and(
          eq(schema.agentRun.orgId, orgId),
          eq(schema.agent.key, valueFinder.key),
          eq(schema.agentRun.contextType, 'relationship'),
          eq(schema.agentRun.contextId, relationshipId),
        ),
      )
      .orderBy(desc(schema.agentRun.createdAt), desc(schema.agentRun.id))
      .limit(1);
    return row?.run ?? null;
  }

  /** Spend des jüngsten Jahres mit Ist-Werten als eigene Eingabe der Beziehung */
  private async spendInput(
    tx: TenantTransaction,
    relationshipId: string,
    asOf: string,
  ): Promise<OpportunityInput | null> {
    const rows = await tx
      .select({
        id: schema.relationshipSpend.id,
        year: schema.relationshipSpend.year,
        amountCents: schema.relationshipSpend.amountCents,
      })
      .from(schema.relationshipSpend)
      .where(
        and(
          eq(schema.relationshipSpend.relationshipId, relationshipId),
          eq(schema.relationshipSpend.kind, 'actual'),
          eq(schema.relationshipSpend.currency, 'EUR'),
          sql`${schema.relationshipSpend.year} <= ${Number(asOf.slice(0, 4))}`,
        ),
      )
      .orderBy(desc(schema.relationshipSpend.year));
    const year = rows[0]?.year;
    const first = rows[0];
    if (year === undefined || !first) return null;
    const total = rows
      .filter((row) => row.year === year)
      .reduce((sum, row) => sum + row.amountCents, 0);
    if (total <= 0) return null;
    const yearEnd = `${year}-12-31`;
    return {
      low: String(total),
      high: String(total),
      source: {
        kind: 'own_data',
        reference: {
          objectType: 'relationship_spend',
          objectId: first.id,
          relationshipId,
          observedOn: yearEnd < asOf ? yearEnd : asOf,
        },
      },
    };
  }

  private async readContext(tx: TenantTransaction, orgId: string, relationshipId: string) {
    const [group] = await tx
      .select({ name: schema.materialGroup.name })
      .from(schema.relationshipMaterialGroup)
      .innerJoin(
        schema.materialGroup,
        eq(schema.materialGroup.id, schema.relationshipMaterialGroup.materialGroupId),
      )
      .where(eq(schema.relationshipMaterialGroup.relationshipId, relationshipId))
      .orderBy(desc(schema.relationshipMaterialGroup.isPrimary))
      .limit(1);
    const [side] = await tx
      .select({ displayName: schema.relationshipSide.displayName })
      .from(schema.relationshipSide)
      .where(
        and(
          eq(schema.relationshipSide.relationshipId, relationshipId),
          eq(schema.relationshipSide.orgId, orgId),
        ),
      );
    const [relationship] = await tx
      .select({ name: schema.organization.name })
      .from(schema.relationship)
      .innerJoin(schema.organization, eq(schema.organization.id, schema.relationship.supplierOrgId))
      .where(eq(schema.relationship.id, relationshipId));
    return {
      materialGroup: group?.name ?? 'Warengruppe',
      supplierName: side?.displayName ?? displayNameOf(relationship?.name ?? 'Lieferant').name,
    };
  }

  /** Eingaben je Vorlage: Annahmen, eigener Spend, Werte aus Signalen mit Quellen */
  private factsFor(
    spend: OpportunityInput | null,
    findings: MarketFinding[],
    overrides: ValueAssumption[] = [],
  ) {
    const facts: Partial<
      Record<OpportunityTemplateKey, { inputs: Record<string, OpportunityInput> }>
    > = {};
    for (const key of opportunityTemplateKeys) {
      const inputs: Record<string, OpportunityInput> = {};
      for (const [field, range] of Object.entries(templateAssumptions[key] ?? {})) {
        // Annahmen der Vorlage, je Kunde änderbar (Einstellungen KI)
        const own = overrides.find((entry) => entry.templateKey === key && entry.field === field);
        inputs[field] = {
          ...(own ? { low: own.low, high: own.high } : range),
          source: { kind: 'template_assumption' },
        };
      }
      if (key === 'index_clause' && spend) inputs.eligible_annual_cost_cents = spend;
      const kind = publicInputs[key];
      const finding = kind ? findings.find((entry) => entry.kind === kind) : undefined;
      if (finding?.values) {
        const citations = finding.sources.flatMap((source) =>
          source.publishedOn
            ? [{ url: source.url, publisher: source.publisher, publishedOn: source.publishedOn }]
            : [],
        );
        const [first, ...rest] = citations;
        if (first) {
          for (const [field, value] of Object.entries(finding.values)) {
            inputs[field] = {
              low: value,
              high: value,
              source: { kind: 'public_source', citations: [first, ...rest] },
            };
          }
        }
      }
      facts[key] = { inputs };
    }
    return facts;
  }

  /** Genau ein Ergebnis je Signal */
  private signalOutcome(finding: MarketFinding, results: Results) {
    const template = (Object.entries(publicInputs) as [OpportunityTemplateKey, string][]).find(
      ([, kind]) => kind === finding.kind,
    )?.[0];
    const result = template ? results.find((entry) => entry.template === template) : undefined;
    if (result?.kind === 'opportunity') return { outcome: 'opportunity' as const, template };
    if (result?.kind === 'gap') return { outcome: 'data_gap' as const, template };
    if (finding.kind === 'technology') return { outcome: 'topic' as const, template: undefined };
    return { outcome: 'no_effect' as const, template: undefined };
  }

  /** Begründung vom Modell; eine Zahl, die in keiner Eingabe steht, verwirft sie (KI-11). */
  private async reasonFor(
    auth: AuthContext,
    runId: string,
    key: OpportunityTemplateKey,
    inputs: Record<string, OpportunityInput>,
    buyer: { low: number; high: number },
    modelText?: (fallback: string) => string,
  ) {
    const fallback = `Berechnet nach der Vorlage „${templateTitles[key]}“ aus den Eingaben im Rechenweg.`;
    const allowed = [
      ...Object.values(inputs).flatMap((input) => [input.low, input.high]),
      ...[buyer.low, buyer.high].flatMap((value) => [String(value), String(euros(value))]),
    ];
    const organization = auth.organization;
    if (!organization) return fallback;
    const system =
      'Begründe in höchstens zwei Sätzen, warum der Hebel für diese Beziehung Wert hat. Nenne nur Zahlen aus den Eingaben.';
    const prompt = JSON.stringify({ vorlage: templateTitles[key], inputs, buyer });
    const text = await this.gateway.call(
      { orgId: organization.id, userId: auth.userId, runId, feature: 'value_opportunity' },
      async (model) => {
        if (!model) {
          const value = modelText
            ? modelText(fallback)
            : `${templateTitles[key]}: Der Wert ergibt sich aus euren Daten und den Annahmen der Vorlage.`;
          return {
            value,
            usage: {
              inputTokens: estimateTokens(system + prompt),
              outputTokens: estimateTokens(value),
            },
          };
        }
        const result = await generateText({ model, system, prompt, maxOutputTokens: 200 });
        return {
          value: result.text.trim(),
          usage: {
            inputTokens: result.usage.inputTokens ?? 0,
            outputTokens: result.usage.outputTokens ?? 0,
          },
        };
      },
    );
    return text && reasonAllowed(text, allowed) ? text : fallback;
  }

  /** Nur für Tests: feste Modellantwort des Testanbieters (z. B. mit erfundener Zahl) */
  testModelText: ((fallback: string) => string) | undefined;

  async run(
    auth: AuthContext,
    relationshipId: string,
    trigger: 'manual' | 'schedule' = 'manual',
  ): Promise<ValueOpportunities> {
    const asOf = isoDate();
    const prepared = await this.scope(auth, relationshipId, async (scope) => {
      if (!this.canDecide(scope)) throw forbidden();
      const { tx, orgId } = scope;
      const versionId = await this.agentVersion(tx, orgId);
      const [run] = await tx
        .insert(schema.agentRun)
        .values({
          orgId,
          agentVersionId: versionId,
          actingUserId: auth.userId,
          startedBy: auth.userId,
          trigger,
          contextRelationshipId: relationshipId,
          contextType: 'relationship',
          contextId: relationshipId,
          status: 'running',
          startedAt: new Date(),
        })
        .returning({ id: schema.agentRun.id });
      if (!run) throw notFound();
      const stepIds: Record<number, string> = {};
      for (const step of runSteps) {
        const [row] = await tx
          .insert(schema.agentStep)
          .values({ orgId, runId: run.id, seq: step.seq, kind: step.kind, title: step.title })
          .returning({ id: schema.agentStep.id });
        if (row) stepIds[step.seq] = row.id;
      }
      const settings = await readAiSettings(tx, orgId);
      const context = await this.readContext(tx, orgId, relationshipId);
      const spend = await this.spendInput(tx, relationshipId, asOf);

      // Marktumfeld nur mit öffentlicher Recherche; jede Anfrage durch den Filter und ins Protokoll.
      let findings: MarketFinding[] = [];
      const research = settings.publicResearch && env.NODE_ENV !== 'production';
      if (research) {
        const forbiddenNumbers = privateNumbers(spend ? [spend] : []);
        const queries = [
          `${context.materialGroup} Rohstoffpreise Index`,
          `${context.materialGroup} Zölle Vorprodukte`,
          `${context.materialGroup} Technologie`,
          `${context.supplierName} Geschäftsbericht`,
        ];
        for (const text of queries.filter((query) => queryAllowed(query, forbiddenNumbers))) {
          await tx.insert(schema.agentOutboundQuery).values({
            orgId,
            runId: run.id,
            stepId: stepIds[3] as string,
            text,
            provider: 'fake',
          });
        }
        findings = fakeMarketFindings(asOf, context.materialGroup)
          .map((finding) => ({ ...finding, sources: datedSources(finding.sources, asOf) }))
          .filter((finding) => finding.sources.length > 0);
      }
      const facts = this.factsFor(spend, findings, settings.valueAssumptions);
      const results = await calculateOpportunities(tx, facts, { relationshipId, asOf });
      await tx
        .update(schema.agentStep)
        .set({ status: 'done', finishedAt: new Date(), detail: {} })
        .where(and(eq(schema.agentStep.runId, run.id), inArray(schema.agentStep.seq, [1, 2, 3])));
      await tx
        .update(schema.agentStep)
        .set({
          status: 'done',
          finishedAt: new Date(),
          detail: {
            results: results.map((result) => ({ template: result.template, kind: result.kind })),
          },
        })
        .where(and(eq(schema.agentStep.runId, run.id), eq(schema.agentStep.seq, 4)));
      return { runId: run.id, orgId, facts, results, findings, research };
    });

    try {
      const reasons = new Map<OpportunityTemplateKey, string>();
      for (const result of prepared.results) {
        if (result.kind !== 'opportunity') continue;
        reasons.set(
          result.template,
          await this.reasonFor(
            auth,
            prepared.runId,
            result.template,
            prepared.facts[result.template]?.inputs ?? {},
            result.buyer,
            this.testModelText,
          ),
        );
      }
      await this.scope(auth, relationshipId, async (scope) => {
        await this.store(scope, prepared, reasons);
      });
    } catch (error) {
      await this.tenant.run({ userId: auth.userId, organizationId: prepared.orgId }, async (tx) => {
        await tx
          .update(schema.agentStep)
          .set({ status: 'failed', finishedAt: new Date() })
          .where(
            and(eq(schema.agentStep.runId, prepared.runId), eq(schema.agentStep.status, 'running')),
          );
        await tx
          .update(schema.agentRun)
          .set({
            status: error instanceof BudgetExhaustedError ? 'aborted_budget' : 'failed',
            finishedAt: new Date(),
          })
          .where(eq(schema.agentRun.id, prepared.runId));
      });
      throw error;
    }
    return this.list(auth, relationshipId);
  }

  /** Entwürfe, Signale und Datenlücken ablegen; ältere offene Potenziale derselben Vorlage ersetzen */
  private async store(
    scope: JbpScope,
    prepared: {
      runId: string;
      orgId: string;
      facts: ReturnType<OpportunitiesService['factsFor']>;
      results: Results;
      findings: MarketFinding[];
    },
    reasons: Map<OpportunityTemplateKey, string>,
  ) {
    const { tx, orgId, relationshipId } = scope;
    const { runId, results, findings, facts } = prepared;
    const signalIds = new Map<OpportunityTemplateKey, string>();
    let gapSignal: string | undefined;
    for (const finding of findings) {
      const { outcome, template } = this.signalOutcome(finding, results);
      const [row] = await tx
        .insert(schema.valueMarketSignal)
        .values({
          orgId,
          relationshipId,
          runId,
          kind: finding.kind,
          title: finding.title,
          summary: finding.summary,
          direction: finding.direction,
          sources: finding.sources.map((source) => ({
            title: source.title,
            url: source.url,
            publishedOn: source.publishedOn as string,
            excerpt: source.excerpt,
          })),
          outcome,
          outcomeReason: signalReasons[outcome],
        })
        .returning({ id: schema.valueMarketSignal.id });
      if (row && template) signalIds.set(template, row.id);
      if (row && outcome === 'data_gap') gapSignal = row.id;
    }

    const opportunities = results.filter((result) => result.kind === 'opportunity');
    if (opportunities.length > 0) {
      await tx
        .update(schema.valueOpportunity)
        .set({ status: 'superseded' })
        .where(
          and(
            eq(schema.valueOpportunity.relationshipId, relationshipId),
            eq(schema.valueOpportunity.status, 'new'),
            inArray(
              schema.valueOpportunity.templateKey,
              opportunities.map((result) => result.template),
            ),
          ),
        );
    }
    for (const result of opportunities) {
      if (result.kind !== 'opportunity') continue;
      const signal = signalIds.get(result.template);
      await tx.insert(schema.valueOpportunity).values({
        orgId,
        relationshipId,
        runId,
        templateKey: result.template,
        templateVersion,
        title: templateTitles[result.template],
        reason: reasons.get(result.template) ?? templateTitles[result.template],
        impactType: result.effect,
        buyerLowCents: result.buyer.low,
        buyerHighCents: result.buyer.high,
        supplierLowCents: result.supplier?.low ?? null,
        supplierHighCents: result.supplier?.high ?? null,
        supplierEffect: templateSupplierEffect[result.template] ?? null,
        confidence: result.confidence.level,
        confidenceReason: result.confidence.reason,
        inputs: facts[result.template]?.inputs ?? {},
        signalIds: signal ? [signal] : [],
      });
    }

    // Offene Lücken früherer Läufe sind ersetzt; je fehlender Eingabe eine neue Zeile.
    await tx
      .update(schema.valueDataGap)
      .set({ status: 'closed' })
      .where(
        and(
          eq(schema.valueDataGap.relationshipId, relationshipId),
          eq(schema.valueDataGap.status, 'open'),
        ),
      );
    const blocked = new Map<string, OpportunityTemplateKey[]>();
    for (const result of results) {
      if (result.kind !== 'gap') continue;
      for (const key of result.missing)
        blocked.set(key, [...(blocked.get(key) ?? []), result.template]);
    }
    for (const [dataKey, templates] of blocked) {
      const fromSignal = templates.some((template) => signalIds.has(template));
      await tx.insert(schema.valueDataGap).values({
        orgId,
        relationshipId,
        runId,
        dataKey,
        description: dataGapDescriptions[dataKey] ?? dataKey,
        templatesBlocked: templates,
        signalId: fromSignal ? (gapSignal ?? null) : null,
      });
    }
    await tx
      .update(schema.agentStep)
      .set({ status: 'done', finishedAt: new Date() })
      .where(and(eq(schema.agentStep.runId, runId), inArray(schema.agentStep.seq, [5, 6])));
    const [cost] = await tx
      .select({ total: sql<string>`coalesce(sum(${schema.modelCall.costMicrocents}), 0)` })
      .from(schema.modelCall)
      .where(and(eq(schema.modelCall.orgId, orgId), eq(schema.modelCall.runId, runId)));
    await tx
      .update(schema.agentRun)
      .set({
        status: 'done',
        finishedAt: new Date(),
        stepsUsed: runSteps.length,
        costMicrocents: Number(cost?.total ?? 0),
      })
      .where(eq(schema.agentRun.id, runId));
  }

  private view(row: OpportunityRow, editable: boolean) {
    const fields = templateFields(row.templateKey as OpportunityTemplateKey);
    return {
      id: row.id,
      templateKey: row.templateKey,
      title: row.title,
      reason: row.reason,
      impactType: row.impactType,
      buyer: { low: row.buyerLowCents, high: row.buyerHighCents },
      supplier:
        row.supplierLowCents === null || row.supplierHighCents === null
          ? null
          : { low: row.supplierLowCents, high: row.supplierHighCents },
      supplierEffect: row.supplierEffect,
      currency: row.currency,
      confidence: row.confidence,
      confidenceReason: row.confidenceReason,
      fromMarket: row.signalIds.length > 0,
      steps: fields.flatMap((field) => {
        const input = opportunityInputSchema.safeParse(row.inputs[field.key]);
        if (!input.success) return [];
        return [
          {
            key: field.key,
            unit: field.unit,
            low: input.data.low,
            high: input.data.high,
            source: input.data.source.kind,
            citations:
              input.data.source.kind === 'public_source' ? input.data.source.citations : [],
            editable: editable && row.status === 'new',
          },
        ];
      }),
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async list(auth: AuthContext, relationshipId: string): Promise<ValueOpportunities> {
    return this.scope(auth, relationshipId, async (scope) => {
      const { tx, orgId } = scope;
      const decide = this.canDecide(scope);
      await syncRealized(tx, orgId, relationshipId);
      const settings = await readAiSettings(tx, orgId);
      const run = await this.lastRun(tx, orgId, relationshipId);
      const rows = await tx
        .select()
        .from(schema.valueOpportunity)
        .where(
          and(
            eq(schema.valueOpportunity.relationshipId, relationshipId),
            eq(schema.valueOpportunity.orgId, orgId),
            inArray(schema.valueOpportunity.status, ['new', 'adopted', 'realized']),
          ),
        )
        .orderBy(desc(schema.valueOpportunity.buyerHighCents));
      const signals = run
        ? await tx
            .select()
            .from(schema.valueMarketSignal)
            .where(
              and(
                eq(schema.valueMarketSignal.orgId, orgId),
                eq(schema.valueMarketSignal.runId, run.id),
              ),
            )
            .orderBy(schema.valueMarketSignal.observedAt)
        : [];
      const gaps = await tx
        .select()
        .from(schema.valueDataGap)
        .where(
          and(
            eq(schema.valueDataGap.relationshipId, relationshipId),
            eq(schema.valueDataGap.orgId, orgId),
            inArray(schema.valueDataGap.status, ['open', 'requested']),
          ),
        );
      const drafts =
        gaps.length > 0
          ? await tx
              .select()
              .from(schema.aiDraft)
              .where(
                and(
                  eq(schema.aiDraft.orgId, orgId),
                  eq(schema.aiDraft.kind, 'data_request'),
                  eq(schema.aiDraft.status, 'draft'),
                  inArray(
                    schema.aiDraft.objectId,
                    gaps.map((gap) => gap.id),
                  ),
                ),
              )
          : [];
      const outbound = run
        ? await tx
            .select({
              text: schema.agentOutboundQuery.text,
              sentAt: schema.agentOutboundQuery.sentAt,
            })
            .from(schema.agentOutboundQuery)
            .where(
              and(
                eq(schema.agentOutboundQuery.orgId, orgId),
                eq(schema.agentOutboundQuery.runId, run.id),
              ),
            )
            .orderBy(schema.agentOutboundQuery.sentAt)
        : [];
      const [check] = run
        ? await tx
            .select({ detail: schema.agentStep.detail })
            .from(schema.agentStep)
            .where(and(eq(schema.agentStep.runId, run.id), eq(schema.agentStep.seq, 4)))
        : [];
      const results =
        (check?.detail as { results?: { template: OpportunityTemplateKey; kind: string }[] } | null)
          ?.results ?? [];

      // Summen nur aus Sicherheit hoch und mittel, je Wirkungsart getrennt
      const counted = rows.filter((row) => row.confidence !== 'low');
      const sum = (impactType: OpportunityImpactType, status: OpportunityRow['status']) => {
        const list = counted.filter(
          (row) => row.impactType === impactType && row.status === status,
        );
        return {
          low: list.reduce((total, row) => total + row.buyerLowCents, 0),
          high: list.reduce((total, row) => total + row.buyerHighCents, 0),
        };
      };
      const totals = opportunityImpactTypes
        .filter((impactType) => rows.some((row) => row.impactType === impactType))
        .map((impactType) => ({
          impactType,
          new: sum(impactType, 'new'),
          adopted: sum(impactType, 'adopted'),
          realized: sum(impactType, 'realized'),
        }));
      return valueOpportunitiesSchema.parse({
        researchEnabled: settings.publicResearch,
        canRun: decide,
        canDecide: decide,
        lastRun: run
          ? { id: run.id, status: run.status, finishedAt: run.finishedAt?.toISOString() ?? null }
          : null,
        counts: {
          new: rows.filter((row) => row.status === 'new').length,
          adopted: rows.filter((row) => row.status === 'adopted').length,
          realized: rows.filter((row) => row.status === 'realized').length,
        },
        totals,
        opportunities: rows.map((row) => this.view(row, decide)),
        checked: {
          templates: results.length,
          checkable: results.filter((result) => result.kind !== 'gap').length,
          withOpportunity: results.filter((result) => result.kind === 'opportunity').length,
          withoutOpportunity: results
            .filter((result) => result.kind === 'no_effect')
            .map((result) => ({ templateKey: result.template })),
          notCheckable: results.filter((result) => result.kind === 'gap').length,
          signals: signals.length,
        },
        signals: signals.map((signal) => ({
          id: signal.id,
          kind: signal.kind,
          title: signal.title,
          summary: signal.summary,
          direction: signal.direction,
          sources: signal.sources,
          outcome: signal.outcome,
          outcomeReason: signal.outcomeReason,
        })),
        dataGaps: gaps.map((gap) => {
          const draft = drafts.find((entry) => entry.objectId === gap.id);
          return {
            id: gap.id,
            dataKey: gap.dataKey,
            description: gap.description,
            templatesBlocked: gap.templatesBlocked,
            status: gap.status,
            draft: draft
              ? { id: draft.id, title: draft.subject ?? '', description: draft.content }
              : null,
          };
        }),
        outbound: outbound.map((query) => ({
          text: query.text,
          sentAt: query.sentAt.toISOString(),
        })),
      });
    });
  }

  private async openOpportunity(scope: JbpScope, id: string) {
    if (!this.canDecide(scope)) throw forbidden();
    const [row] = await scope.tx
      .select()
      .from(schema.valueOpportunity)
      .where(
        and(
          eq(schema.valueOpportunity.id, id),
          eq(schema.valueOpportunity.orgId, scope.orgId),
          eq(schema.valueOpportunity.relationshipId, scope.relationshipId),
        ),
      );
    if (!row) throw notFound();
    if (row.status !== 'new') throw new ConflictException({ statusCode: 409, code: 'nicht_offen' });
    return row;
  }

  /** Annahmen ändern: rechnet neu, Herkunft user_assumption, Protokoll mit altem und neuem Wert */
  async changeAssumptions(
    auth: AuthContext,
    relationshipId: string,
    id: string,
    input: ChangeAssumptions,
  ): Promise<ValueOpportunities> {
    await this.scope(auth, relationshipId, async (scope) => {
      const row = await this.openOpportunity(scope, id);
      const key = row.templateKey as OpportunityTemplateKey;
      const current = row.inputs as Record<string, OpportunityInput>;
      const fields = new Set(templateFields(key).map((field) => field.key));
      const next = { ...current };
      const before: Record<string, { low: string; high: string }> = {};
      const after: Record<string, { low: string; high: string }> = {};
      for (const [field, range] of Object.entries(input.inputs)) {
        const old = current[field];
        if (!fields.has(field) || !old) {
          throw new ConflictException({ statusCode: 409, code: 'unbekannte_eingabe' });
        }
        before[field] = { low: old.low, high: old.high };
        after[field] = range;
        next[field] = { ...range, source: { kind: 'user_assumption' } };
      }
      const result = await calculateOpportunity(scope.tx, key, next, {
        relationshipId,
        asOf: isoDate(),
      });
      if (result.kind !== 'opportunity') {
        throw new ConflictException({ statusCode: 409, code: 'kein_potenzial' });
      }
      const actor = await actorOf(scope.tx, auth, scope.orgId);
      await auditedChange(scope.tx, actor, valueOpportunityAudit, async () => {
        await scope.tx
          .update(schema.valueOpportunity)
          .set({
            inputs: next,
            buyerLowCents: result.buyer.low,
            buyerHighCents: result.buyer.high,
            supplierLowCents: result.supplier?.low ?? null,
            supplierHighCents: result.supplier?.high ?? null,
            confidence: result.confidence.level,
            confidenceReason: result.confidence.reason,
          })
          .where(eq(schema.valueOpportunity.id, id));
        return {
          objectId: id,
          relationshipId,
          action: 'updated' as const,
          before: { inputs: before },
          after: { inputs: after },
          result: undefined,
        };
      });
    });
    return this.list(auth, relationshipId);
  }

  async dismiss(auth: AuthContext, relationshipId: string, id: string, reason: string) {
    await this.scope(auth, relationshipId, async (scope) => {
      await this.openOpportunity(scope, id);
      const actor = await actorOf(scope.tx, auth, scope.orgId);
      await auditedChange(scope.tx, actor, valueOpportunityAudit, async () => {
        await scope.tx
          .update(schema.valueOpportunity)
          .set({
            status: 'dismissed',
            dismissReason: reason,
            decidedBy: auth.userId,
            decidedAt: new Date(),
          })
          .where(eq(schema.valueOpportunity.id, id));
        return {
          objectId: id,
          relationshipId,
          action: 'updated' as const,
          before: { status: 'new' },
          after: { status: 'dismissed', dismiss_reason: reason },
          result: undefined,
        };
      });
    });
    return this.list(auth, relationshipId);
  }

  /** Was der Lieferant sehen wird: Titel und teilbare Beschreibung, ohne Zahl und Quelle */
  proposal(auth: AuthContext, relationshipId: string, id: string) {
    return this.scope(auth, relationshipId, async (scope) => {
      const row = await this.openOpportunity(scope, id);
      const key = row.templateKey as OpportunityTemplateKey;
      return { title: templateTitles[key], description: templateShareText[key] };
    });
  }

  /** Erst nach Bestätigung entsteht das geteilte Thema im JBP; das Potenzial verweist darauf. */
  async adopt(auth: AuthContext, relationshipId: string, id: string, input: AdoptOpportunity) {
    await this.scope(auth, relationshipId, async (scope) => {
      await this.openOpportunity(scope, id);
      await this.topics.create(scope, input);
      const [topic] = await scope.tx
        .select({ id: schema.jbpTopic.id })
        .from(schema.jbpTopic)
        .where(
          and(
            eq(schema.jbpTopic.relationshipId, relationshipId),
            eq(schema.jbpTopic.ownerOrgId, scope.orgId),
            eq(schema.jbpTopic.createdBy, auth.userId),
            eq(schema.jbpTopic.title, input.title),
          ),
        )
        .orderBy(desc(schema.jbpTopic.createdAt))
        .limit(1);
      if (!topic) throw notFound();
      const actor = await actorOf(scope.tx, auth, scope.orgId);
      await auditedChange(scope.tx, actor, valueOpportunityAudit, async () => {
        await scope.tx
          .update(schema.valueOpportunity)
          .set({
            status: 'adopted',
            adoptedTopicId: topic.id,
            decidedBy: auth.userId,
            decidedAt: new Date(),
          })
          .where(eq(schema.valueOpportunity.id, id));
        return {
          objectId: id,
          relationshipId,
          action: 'updated' as const,
          before: { status: 'new' },
          after: { status: 'adopted', adopted_topic_id: topic.id },
          result: undefined,
        };
      });
    });
    return this.list(auth, relationshipId);
  }
  private async openGap(scope: JbpScope, gapId: string) {
    if (!this.canDecide(scope)) throw forbidden();
    const [gap] = await scope.tx
      .select()
      .from(schema.valueDataGap)
      .where(
        and(
          eq(schema.valueDataGap.id, gapId),
          eq(schema.valueDataGap.orgId, scope.orgId),
          eq(schema.valueDataGap.relationshipId, scope.relationshipId),
        ),
      );
    if (!gap) throw notFound();
    if (gap.status !== 'open')
      throw new ConflictException({ statusCode: 409, code: 'nicht_offen' });
    return gap;
  }

  private async openDraft(scope: JbpScope, gapId: string) {
    const [draft] = await scope.tx
      .select()
      .from(schema.aiDraft)
      .where(
        and(
          eq(schema.aiDraft.orgId, scope.orgId),
          eq(schema.aiDraft.kind, 'data_request'),
          eq(schema.aiDraft.objectId, gapId),
          eq(schema.aiDraft.status, 'draft'),
        ),
      );
    return draft ?? null;
  }

  /**
   * Anfrage an den Lieferanten entwerfen (KI-11, Ablauf 5): ein Entwurf nach KI-03, ohne Zahl und
   * ohne interne Angabe. Gesendet wird nichts; das geschieht erst mit sendDataRequest.
   */
  async draftDataRequest(auth: AuthContext, relationshipId: string, gapId: string) {
    await this.scope(auth, relationshipId, async (scope) => {
      const gap = await this.openGap(scope, gapId);
      if (await this.openDraft(scope, gapId)) return;
      const { supplierName } = await this.readContext(scope.tx, scope.orgId, relationshipId);
      await scope.tx.insert(schema.aiDraft).values({
        orgId: scope.orgId,
        relationshipId,
        kind: 'data_request',
        objectType: 'value_data_gap',
        objectId: gap.id,
        subject: `Daten bereitstellen: ${gap.description}`,
        content: `Liebes Team von ${supplierName}, für unsere gemeinsame Planung bitten wir euch um folgende Angabe: ${gap.description}. Damit können wir prüfen, welche Hebel sich für beide Seiten lohnen.`,
        model: 'reziproq',
        createdBy: auth.userId,
      });
    });
    return this.list(auth, relationshipId);
  }

  /** Erst jetzt entsteht die geteilte Maßnahme beim Lieferanten; die Lücke bekommt requested. */
  async sendDataRequest(
    auth: AuthContext,
    relationshipId: string,
    gapId: string,
    input: SendDataRequest,
  ) {
    const prepared = await this.scope(auth, relationshipId, async (scope) => {
      await this.openGap(scope, gapId);
      const draft = await this.openDraft(scope, gapId);
      if (!draft) throw notFound();
      const { supplierName } = await this.readContext(scope.tx, scope.orgId, relationshipId);
      return { draft, supplierName };
    });
    await this.actions.buyer(auth, relationshipId, (scope) =>
      this.actions.create(scope, {
        action: {
          title: input.title,
          description: input.description || null,
          visibility: 'shared',
          ownerSide: 'supplier',
          ownerUserId: null,
          ownerName: prepared.supplierName,
          dueDate: input.dueDate,
        },
        sourceType: 'manual',
        sourceId: null,
      }),
    );
    await this.scope(auth, relationshipId, async (scope) => {
      await scope.tx
        .update(schema.aiDraft)
        .set({
          status: 'accepted',
          edited:
            input.title !== prepared.draft.subject || input.description !== prepared.draft.content,
          decidedBy: auth.userId,
          decidedAt: new Date(),
        })
        .where(eq(schema.aiDraft.id, prepared.draft.id));
      await scope.tx
        .update(schema.valueDataGap)
        .set({ status: 'requested' })
        .where(eq(schema.valueDataGap.id, gapId));
    });
    return this.list(auth, relationshipId);
  }

  async discardDataRequest(auth: AuthContext, relationshipId: string, gapId: string) {
    await this.scope(auth, relationshipId, async (scope) => {
      await this.openGap(scope, gapId);
      const draft = await this.openDraft(scope, gapId);
      if (!draft) throw notFound();
      await scope.tx
        .update(schema.aiDraft)
        .set({ status: 'discarded', decidedBy: auth.userId, decidedAt: new Date() })
        .where(eq(schema.aiDraft.id, draft.id));
    });
    return this.list(auth, relationshipId);
  }
}
