import { stepCountIs, streamText } from 'ai';
import type { PromptLanguageModel, PromptModel, TurnRequest, TurnResult } from './prompt-model.js';

const maxTurns = 4;

export class AiSdkPromptModel implements PromptModel {
  constructor(private readonly model: PromptLanguageModel) {}

  async turn({ system, messages, tools, onText, signal }: TurnRequest): Promise<TurnResult> {
    let streamError: unknown;
    const result = streamText({
      model: this.model,
      system,
      messages,
      tools,
      stopWhen: stepCountIs(maxTurns),
      abortSignal: signal,
      maxOutputTokens: 1200,
      onError: ({ error }) => {
        streamError = error;
      },
    });

    for await (const part of result.stream) {
      if (part.type === 'text-delta') onText(part.text);
      if (part.type === 'error') streamError = part.error;
    }
    if (streamError) throw streamError;

    const usage = await result.usage;
    return {
      usage: {
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
      },
    };
  }
}
