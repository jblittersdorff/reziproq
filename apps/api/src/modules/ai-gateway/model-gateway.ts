import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { and, currentTime, eq, schema, sql, systemTime } from '@reziproq/db';
import {
  type AiFeature,
  aiFeatureClasses,
  type DueItem,
  orgWorkerState,
  workerOfFeature,
} from '@reziproq/shared';
import type { LanguageModel } from 'ai';
import { createLanguageModel } from '../../common/ai-language-model.js';
import { TenantDatabase } from '../../common/database.module.js';
import { env } from '../../config/env.js';
import { readAiSettings } from './ai-settings.js';
import {
  BudgetExhaustedError,
  RegionRejectedError,
  WorkerDisabledError,
} from './gateway-errors.js';
import {
  costMicrocents,
  type GatewayProvider,
  isEuRegion,
  modelIdFor,
  regionFor,
} from './routing.js';

export interface GatewayContext {
  orgId: string;
  /** Wer den Aufruf auslöst; nur für die Mandanten-Session, nicht gespeichert. */
  userId: string;
  feature: AiFeature;
  runId?: string;
}

export interface GatewayUsage {
  inputTokens: number;
  outputTokens: number;
}

/** Anbieter aus der Umgebung: test → fake, bedrock → bedrock_eu. */
export function gatewayProvider(): GatewayProvider {
  if (env.AI_PROVIDER === 'bedrock') return 'bedrock_eu';
  if (env.AI_PROVIDER === 'anthropic') return 'anthropic';
  return 'fake';
}

/** Grobe Schätzung für das Testmodell: etwa vier Zeichen je Token. */
export const estimateTokens = (text: string) => Math.ceil(text.length / 4);

/**
 * KI-01: Jeder Modellaufruf läuft hier durch. Das Gateway wählt das Modell nach Funktion, lehnt
 * Aufrufe außerhalb der EU ab, stoppt bei erreichtem Monatsbudget und schreibt je Aufruf genau eine
 * Zeile in model_call. Ins Protokoll kommen nie Eingaben oder Antworten.
 */
@Injectable()
export class ModelGateway {
  private readonly logger = new Logger('KI-Gateway');
  private readonly models = new Map<string, Promise<LanguageModel | null>>();

  constructor(@Inject(TenantDatabase) private readonly tenant: TenantDatabase) {}

  private modelFor(modelId: string) {
    let model = this.models.get(modelId);
    if (!model) {
      model = createLanguageModel(modelId);
      this.models.set(modelId, model);
    }
    return model;
  }

  /** Verbrauch des laufenden Monats in Mikrocent */
  async monthMicrocents(context: Pick<GatewayContext, 'orgId' | 'userId'>) {
    return this.tenant.run(
      { userId: context.userId, organizationId: context.orgId },
      async (tx) => {
        const [row] = await tx
          .select({
            total: sql<string>`coalesce(sum(${schema.modelCall.costMicrocents}), 0)`,
          })
          .from(schema.modelCall)
          .where(
            and(
              eq(schema.modelCall.orgId, context.orgId),
              sql`${schema.modelCall.createdAt} >= date_trunc('month', app_now())`,
            ),
          );
        return Number(row?.total ?? 0);
      },
      { readOnly: true },
    );
  }

  private async record(
    context: GatewayContext,
    entry: {
      modelClass: (typeof aiFeatureClasses)[AiFeature];
      provider: GatewayProvider;
      modelId: string;
      region: string;
      outcome: 'ok' | 'failed' | 'rejected_region' | 'rejected_budget';
      usage?: GatewayUsage;
      latencyMs?: number;
    },
  ) {
    const usage = entry.usage ?? { inputTokens: 0, outputTokens: 0 };
    await this.tenant.run({ userId: context.userId, organizationId: context.orgId }, (tx) =>
      tx.insert(schema.modelCall).values({
        orgId: context.orgId,
        runId: context.runId ?? null,
        feature: context.feature,
        modelClass: entry.modelClass,
        provider: entry.provider,
        modelId: entry.modelId,
        region: entry.region,
        outcome: entry.outcome,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costMicrocents:
          entry.outcome === 'ok' ? costMicrocents(entry.modelId, entry.modelClass, usage) : 0,
        latencyMs: entry.latencyMs ?? 0,
      }),
    );
  }

  /** Prüft die Freigabe vor jedem Modellschritt und liefert dessen Abrechnung. */
  async beginStep(context: GatewayContext) {
    const modelClass = aiFeatureClasses[context.feature];
    const provider = gatewayProvider();
    const modelId = modelIdFor(provider, modelClass);
    const region = regionFor(provider, modelId, env.AWS_REGION);
    const base = { modelClass, provider, modelId, region };

    if (!isEuRegion(region)) {
      this.logger.warn(
        JSON.stringify({ abgelehnt: 'region', region, funktion: context.feature, modelId }),
      );
      await this.record(context, { ...base, outcome: 'rejected_region' });
      throw new RegionRejectedError(region);
    }

    const settings = await this.tenant.run(
      { userId: context.userId, organizationId: context.orgId },
      (tx) => readAiSettings(tx, context.orgId),
      { readOnly: true },
    );
    // MA-01 (K1-f): Gehört die Funktion zu einer Aufgabe, die die Organisation ausgeschaltet hat,
    // gibt es keinen Aufruf (T1-MA4).
    const worker = workerOfFeature(context.feature);
    if (worker && !orgWorkerState(settings.workers, worker).enabled) {
      throw new WorkerDisabledError(worker.key);
    }
    if ((await this.monthMicrocents(context)) >= settings.budgetMonthCents * 1_000_000) {
      await this.record(context, { ...base, outcome: 'rejected_budget' });
      throw new BudgetExhaustedError();
    }

    const started = systemTime().getTime();
    return (usage?: GatewayUsage) =>
      this.record(context, {
        ...base,
        outcome: usage ? 'ok' : 'failed',
        ...(usage && { usage }),
        latencyMs: systemTime().getTime() - started,
      });
  }

  /** Das Modell für Fragen steht fest. Jede Streaming-Stufe meldet sich bei beginStep an. */
  promptModel(): Promise<LanguageModel | null> {
    return this.modelFor(modelIdFor('bedrock_eu', aiFeatureClasses.prompt));
  }

  /**
   * Führt einen Modellaufruf aus. work bekommt das Sprachmodell oder null beim Testanbieter (dann
   * nimmt der Aufrufer sein festes Testmodell) und meldet die verbrauchten Tokens.
   */
  async call<T>(
    context: GatewayContext,
    work: (model: LanguageModel | null) => Promise<{ value: T; usage: GatewayUsage }>,
  ): Promise<T> {
    const finish = await this.beginStep(context);
    let result: { value: T; usage: GatewayUsage };
    try {
      const modelId = modelIdFor(gatewayProvider(), aiFeatureClasses[context.feature]);
      result = await work(await this.modelFor(modelId));
    } catch (error) {
      await finish();
      throw error;
    }
    await finish(result.usage);
    return result.value;
  }

  async budgetDue(context: Pick<GatewayContext, 'orgId' | 'userId'>): Promise<DueItem[]> {
    const settings = await this.tenant.run(
      { userId: context.userId, organizationId: context.orgId },
      (tx) => readAiSettings(tx, context.orgId),
      { readOnly: true },
    );
    if (
      settings.budgetMonthCents === 0 ||
      (await this.monthMicrocents(context)) < settings.budgetMonthCents * 800_000
    )
      return [];
    const today = currentTime().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    return [
      {
        id: `ai-budget-${month}`,
        kind: 'ai_budget',
        supplier: '',
        detail: null,
        dueDate: `${month}-01`,
        href: '/einstellungen/ki',
      },
    ];
  }
}

/** Gateway-Kontext aus der Anmeldung; ohne Organisation gibt es keinen Modellaufruf. */
export function gatewayContext(
  auth: { userId: string; organization: { id: string } | null },
  feature: AiFeature,
): GatewayContext {
  if (!auth.organization) {
    throw new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
  }
  return { orgId: auth.organization.id, userId: auth.userId, feature };
}
