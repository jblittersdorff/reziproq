import { describe, expect, it } from 'vitest';
import { AnthropicPromptModel } from './anthropic-model.js';

// Prüft den Aufruf an Claude, ohne ins Internet zu gehen: Die Anthropic-SDK bekommt ein
// nachgebautes fetch, das eine kurze gestreamte Antwort im SSE-Format liefert.
function fakeAnthropic() {
  const requests: Record<string, unknown>[] = [];
  const event = (type: string, data: object) =>
    `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  const sse = [
    event('message_start', {
      message: {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'x',
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 12, output_tokens: 0 },
      },
    }),
    event('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }),
    event('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'Hallo ' } }),
    event('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'Anna' } }),
    event('content_block_stop', { index: 0 }),
    event('message_delta', {
      delta: { stop_reason: 'end_turn', stop_sequence: null },
      usage: { output_tokens: 3 },
    }),
    event('message_stop', {}),
  ].join('');

  const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    requests.push({
      body: JSON.parse(String(init?.body)),
      beta: new Headers(init?.headers).get('anthropic-beta'),
    });
    return new Response(sse, { headers: { 'content-type': 'text/event-stream' } });
  };
  return { fetch, requests };
}

describe('AnthropicPromptModel', () => {
  it.each(['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'] as const)(
    'fragt das eingestellte Modell %s mit Werkzeugen und Ersatzmodellen an',
    async (model) => {
      const api = fakeAnthropic();
      const claude = new AnthropicPromptModel(model, { apiKey: 'sk-test', fetch: api.fetch });
      const deltas: string[] = [];

      const result = await claude.turn({
        system: 'System',
        messages: [{ role: 'user', content: 'Hallo' }],
        tools: [],
        onText: (delta) => deltas.push(delta),
        signal: new AbortController().signal,
      });

      expect(api.requests).toHaveLength(1);
      expect(api.requests[0]).toMatchObject({
        body: {
          model,
          stream: true,
          system: 'System',
          fallbacks: 'default',
          output_config: { effort: 'low' },
        },
        beta: expect.stringContaining('server-side-fallback-2026-07-01'),
      });
      expect(deltas).toEqual(['Hallo ', 'Anna']);
      expect(result).toMatchObject({
        stopReason: 'end_turn',
        usage: { inputTokens: 12, outputTokens: 3 },
      });
    },
  );
});
