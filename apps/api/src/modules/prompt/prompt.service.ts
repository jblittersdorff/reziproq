import { Inject, Injectable } from '@nestjs/common';
import { systemTime } from '@reziproq/db';
import type { PromptEvent, PromptRequest } from '@reziproq/shared';
import { ActivitiesService } from '../activities/activities.service.js';
import { gatewayContext, gatewayProvider, ModelGateway } from '../ai-gateway/model-gateway.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { SuppliersService } from '../suppliers/suppliers.service.js';
import { AiSdkPromptModel } from './ai-sdk-model.js';
import { PromptLog } from './prompt-log.js';
import { PROMPT_MODEL, type PromptModel, type TurnRequest } from './prompt-model.js';
import { systemPrompt } from './system-prompt.js';
import { createPromptTools, invokePromptTool } from './tools.js';

export const promptFailure = 'Gerade keine Antwort möglich. Versuch es gleich noch einmal.';

@Injectable()
export class PromptService {
  constructor(
    @Inject(PROMPT_MODEL) private readonly model: PromptModel,
    @Inject(SuppliersService) private readonly suppliers: SuppliersService,
    @Inject(PromptLog) private readonly log: PromptLog,
    @Inject(ModelGateway) private readonly gateway: ModelGateway,
    @Inject(ActivitiesService) private readonly activities: ActivitiesService,
  ) {}

  /**
   * NAV-10: Mit Kontext nennt die Anweisung den Lieferanten. Nur wenn die Person ihn sieht; sonst
   * bleibt die Frage ohne Kontext (kein Hinweis darauf, dass es ihn gibt).
   */
  private async systemFor(auth: AuthContext, request: PromptRequest): Promise<string> {
    const relationshipId = request.context?.relationshipId;
    if (!relationshipId) return systemPrompt;
    const supplier = await this.suppliers.detail(auth, relationshipId).catch(() => null);
    if (!supplier) return systemPrompt;
    return `${systemPrompt}\n\nKontext: Die Person ist auf der Seite des Lieferanten „${supplier.name}“. Fragen zu „diesem Lieferanten“ oder „hier“ beziehen sich auf ihn.`;
  }

  /** Beantwortet eine Frage und meldet Text, Treffer und Sprünge als Ereignisse. */
  async answer(
    auth: AuthContext,
    request: PromptRequest,
    emit: (event: PromptEvent) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const started = performance.now();
    const usage = { inputTokens: 0, outputTokens: 0 };
    let success = false;

    const messages = request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    try {
      const system = await this.systemFor(auth, request);
      const tools = createPromptTools((name, input) =>
        invokePromptTool(name, input, auth, this.suppliers, emit, this.activities),
      );
      const context = gatewayContext(auth, 'prompt');
      const turnRequest: TurnRequest = {
        system,
        messages,
        tools,
        invokeTool: (name, input) =>
          invokePromptTool(name, input, auth, this.suppliers, emit, this.activities),
        onText: (delta) => emit({ type: 'text', delta }),
        signal,
      };
      const result =
        gatewayProvider() === 'bedrock_eu'
          ? await this.gateway.promptModel().then((model) => {
              if (!model) throw new Error('Bedrock-Modell fehlt.');
              return new AiSdkPromptModel(model, () => this.gateway.beginStep(context)).turn(
                turnRequest,
              );
            })
          : await this.gateway.call(context, async () => {
              const turn = await this.model.turn(turnRequest);
              return { value: turn, usage: turn.usage };
            });
      usage.inputTokens += result.usage.inputTokens;
      usage.outputTokens += result.usage.outputTokens;
      emit({ type: 'done' });
      success = true;
    } catch {
      emit({ type: 'error', message: promptFailure });
    } finally {
      this.log.write({
        zeitpunkt: systemTime().toISOString(),
        nutzerId: auth.userId,
        organisationId: auth.organization?.id ?? null,
        dauerMs: Math.round(performance.now() - started),
        eingabeTokens: usage.inputTokens,
        ausgabeTokens: usage.outputTokens,
        erfolg: success,
      });
    }
  }
}
