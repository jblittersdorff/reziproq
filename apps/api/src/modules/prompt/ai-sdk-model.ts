import { stepCountIs, streamText } from 'ai';
import type { GatewayUsage } from '../ai-gateway/model-gateway.js';
import type { PromptLanguageModel, PromptModel, TurnRequest, TurnResult } from './prompt-model.js';

const maxTurns = 4;

export class AiSdkPromptModel implements PromptModel {
  constructor(
    private readonly model: PromptLanguageModel,
    private readonly beginStep: () => Promise<(usage?: GatewayUsage) => Promise<void>>,
  ) {}

  async turn({ system, messages, tools, onText, signal }: TurnRequest): Promise<TurnResult> {
    let streamError: unknown;
    let finish: ((usage?: GatewayUsage) => Promise<void>) | undefined;
    let recordError: unknown;
    const result = streamText({
      model: this.model,
      system,
      messages,
      tools,
      stopWhen: stepCountIs(maxTurns),
      abortSignal: signal,
      maxOutputTokens: 1200,
      maxRetries: 0,
      streamRetries: 0,
      prepareStep: async () => {
        if (recordError) throw recordError;
        finish = await this.beginStep();
        return {};
      },
      onStepEnd: async ({ usage }) => {
        const record = finish;
        finish = undefined;
        try {
          await record?.({
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
          });
        } catch (error) {
          recordError = error;
        }
      },
      onError: ({ error }) => {
        streamError = error;
      },
    });

    try {
      for await (const part of result.stream) {
        if (part.type === 'text-delta') onText(part.text);
        if (part.type === 'error') streamError = part.error;
      }
    } finally {
      await finish?.();
    }
    if (recordError) throw recordError;
    if (streamError) throw streamError;

    const usage = await result.totalUsage;
    return {
      usage: {
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
      },
    };
  }
}
