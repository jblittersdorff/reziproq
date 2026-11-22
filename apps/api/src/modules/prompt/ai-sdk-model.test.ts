import type { LanguageModel } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiSdkPromptModel } from './ai-sdk-model.js';

const streamTextMock = vi.hoisted(() => vi.fn());

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, streamText: streamTextMock };
});

describe('AiSdkPromptModel', () => {
  beforeEach(() => {
    streamTextMock.mockReset();
  });

  it('streamt Text, begrenzt Werkzeugschritte und gibt Tokenverbrauch zurück', async () => {
    const record = vi.fn(async () => {});
    const beginStep = vi.fn(async () => record);
    streamTextMock.mockImplementation(({ prepareStep, onStepEnd }) => ({
      stream: (async function* () {
        await prepareStep();
        yield { type: 'text-delta', text: 'Hallo ' };
        await onStepEnd({ usage: { inputTokens: 5, outputTokens: 1 } });
        await prepareStep();
        yield { type: 'text-delta', text: 'Anna' };
        await onStepEnd({ usage: { inputTokens: 7, outputTokens: 2 } });
      })(),
      totalUsage: Promise.resolve({ inputTokens: 12, outputTokens: 3 }),
    }));

    const model = new AiSdkPromptModel({} as LanguageModel, beginStep);
    const deltas: string[] = [];
    const signal = new AbortController().signal;
    const result = await model.turn({
      system: 'System',
      messages: [{ role: 'user', content: 'Hallo' }],
      tools: {},
      invokeTool: vi.fn(),
      onText: (delta) => deltas.push(delta),
      signal,
    });

    expect(deltas).toEqual(['Hallo ', 'Anna']);
    expect(beginStep).toHaveBeenCalledTimes(2);
    expect(record.mock.calls).toEqual([
      [{ inputTokens: 5, outputTokens: 1 }],
      [{ inputTokens: 7, outputTokens: 2 }],
    ]);
    expect(result).toEqual({ usage: { inputTokens: 12, outputTokens: 3 } });
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: expect.anything(),
        system: 'System',
        messages: [{ role: 'user', content: 'Hallo' }],
        tools: {},
        abortSignal: signal,
        maxOutputTokens: 1200,
        stopWhen: expect.any(Function),
      }),
    );
  });

  it('meldet Modellfehler nach dem Stream weiter', async () => {
    const failure = new Error('model unavailable');
    const record = vi.fn(async () => {});
    streamTextMock.mockImplementation(({ prepareStep }) => ({
      stream: (async function* () {
        await prepareStep();
        yield { type: 'error', error: failure };
      })(),
    }));

    const model = new AiSdkPromptModel({} as LanguageModel, async () => record);
    await expect(
      model.turn({
        system: 'System',
        messages: [{ role: 'user', content: 'Hallo' }],
        tools: {},
        invokeTool: vi.fn(),
        onText: vi.fn(),
        signal: new AbortController().signal,
      }),
    ).rejects.toBe(failure);
    expect(record.mock.calls).toEqual([[]]);
  });
});
