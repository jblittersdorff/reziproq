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
    streamTextMock.mockReturnValue({
      stream: (async function* () {
        yield { type: 'text-delta', text: 'Hallo ' };
        yield { type: 'text-delta', text: 'Anna' };
      })(),
      usage: Promise.resolve({ inputTokens: 12, outputTokens: 3 }),
    });

    const model = new AiSdkPromptModel({} as LanguageModel);
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
    streamTextMock.mockReturnValue({
      stream: (async function* () {
        yield { type: 'error', error: failure };
      })(),
      usage: Promise.resolve({ inputTokens: 0, outputTokens: 0 }),
    });

    const model = new AiSdkPromptModel({} as LanguageModel);
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
  });
});
