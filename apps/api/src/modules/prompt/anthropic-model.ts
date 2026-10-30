import Anthropic from '@anthropic-ai/sdk';
import type { Env } from '../../config/env.js';
import type { PromptModel, TurnRequest, TurnResult } from './prompt-model.js';

/**
 * Claude über die Anthropic-API. Welches Modell antwortet, steht in KI_MODELL
 * (Haiku, Sonnet oder Opus); der Rest des Aufrufs bleibt gleich.
 */
export class AnthropicPromptModel implements PromptModel {
  private readonly client: Anthropic;

  constructor(
    private readonly model: Env['KI_MODELL'],
    options: ConstructorParameters<typeof Anthropic>[0],
  ) {
    this.client = new Anthropic(options);
  }

  async turn({ system, messages, tools, onText, signal }: TurnRequest): Promise<TurnResult> {
    const stream = this.client.beta.messages.stream(
      {
        model: this.model,
        max_tokens: 16000,
        system,
        messages,
        tools,
        // Kurze Antworten auf einfache Fragen: wenig Denkaufwand reicht.
        output_config: { effort: 'low' },
        // Lehnt ein Modell aus Sicherheitsgründen ab, versucht es die API mit einem Ersatzmodell.
        // Modelle ohne Ersatz (z. B. Haiku) antworten dann einfach allein.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      },
      { signal },
    );
    stream.on('text', onText);
    const message = await stream.finalMessage();
    return {
      content: message.content,
      stopReason: message.stop_reason,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      },
    };
  }
}
