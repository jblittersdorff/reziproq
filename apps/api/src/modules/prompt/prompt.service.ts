import type Anthropic from '@anthropic-ai/sdk';
import { Inject, Injectable } from '@nestjs/common';
import type { PromptEvent, PromptRequest } from '@reziproq/shared';
import type { AuthContext } from '../auth/auth.guard.js';
import { SuppliersService } from '../suppliers/suppliers.service.js';
import { PromptLog } from './prompt-log.js';
import { PROMPT_MODEL, type PromptModel } from './prompt-model.js';
import { systemPrompt } from './system-prompt.js';
import { runTool, tools } from './tools.js';

// Höchstens so viele Schritte je Frage: Werkzeug aufrufen, Ergebnis lesen, antworten.
const maxTurns = 4;

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

    const messages: Anthropic.Beta.BetaMessageParam[] = request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    try {
      for (let turn = 0; turn < maxTurns; turn++) {
        const result = await this.model.turn({
          system: systemPrompt,
          messages,
          tools,
          onText: (delta) => emit({ type: 'text', delta }),
          signal,
        });
        usage.inputTokens += result.usage.inputTokens;
        usage.outputTokens += result.usage.outputTokens;

        const toolUses = result.content.filter(
          (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use',
        );
        // Eine Ablehnung kann einen Werkzeugaufruf mitten in der Eingabe abschneiden.
        if (result.stopReason === 'refusal') throw new Error('refusal');
        if (result.stopReason !== 'tool_use' || toolUses.length === 0) break;

        messages.push({ role: 'assistant', content: result.content });
        const results = [];
        for (const use of toolUses) {
          results.push(await runTool(use, auth, this.suppliers, emit));
        }
        messages.push({ role: 'user', content: results });
      }
      emit({ type: 'done' });
      success = true;
    } catch {
      emit({ type: 'error', message: promptFailure });
    } finally {
      this.log.write({
        zeitpunkt: new Date().toISOString(),
        nutzerId: auth.userId,
        dauerMs: Math.round(performance.now() - started),
        eingabeTokens: usage.inputTokens,
        ausgabeTokens: usage.outputTokens,
        erfolg: success,
      });
    }
  }
}
