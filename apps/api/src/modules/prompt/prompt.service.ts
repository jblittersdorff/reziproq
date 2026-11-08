import { Inject, Injectable } from '@nestjs/common';
import type { PromptEvent, PromptRequest } from '@reziproq/shared';
import type { AuthContext } from '../auth/auth.guard.js';
import { SuppliersService } from '../suppliers/suppliers.service.js';
import { PromptLog } from './prompt-log.js';
import { PROMPT_MODEL, type PromptModel } from './prompt-model.js';
import { systemPrompt } from './system-prompt.js';
import { createPromptTools, invokePromptTool } from './tools.js';

export const promptFailure = 'Gerade keine Antwort möglich. Versuch es gleich noch einmal.';

@Injectable()
export class PromptService {
  constructor(
    @Inject(PROMPT_MODEL) private readonly model: PromptModel,
    @Inject(SuppliersService) private readonly suppliers: SuppliersService,
    @Inject(PromptLog) private readonly log: PromptLog,
  ) {}

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
      const tools = createPromptTools((name, input) =>
        invokePromptTool(name, input, auth, this.suppliers, emit),
      );
      const result = await this.model.turn({
        system: systemPrompt,
        messages,
        tools,
        invokeTool: (name, input) => invokePromptTool(name, input, auth, this.suppliers, emit),
        onText: (delta) => emit({ type: 'text', delta }),
        signal,
      });
      usage.inputTokens += result.usage.inputTokens;
      usage.outputTokens += result.usage.outputTokens;
      emit({ type: 'done' });
      success = true;
    } catch {
      emit({ type: 'error', message: promptFailure });
    } finally {
      this.log.write({
        zeitpunkt: new Date().toISOString(),
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
