import { createHash } from 'node:crypto';
import {
  type LanguageModel,
  type LanguageModelMiddleware,
  simulateReadableStream,
  wrapLanguageModel,
} from 'ai';

// DM-01, KI-01 (K1-b.1): Aufzeichnen und Abspielen von Modellantworten im Demo-Mandanten.
// Das Gateway legt eine Zwischenschicht um das Modell: Im Modus record ruft es das Modell auf und
// speichert die Antwort zum Hash der Eingabe; im Modus replay liefert es eine gespeicherte Antwort,
// ohne das Modell zu fragen, sonst ruft es live auf. IDs (UUIDs) in Eingabe und Antwort werden durch
// Platzhalter in der Reihenfolge ihres Auftretens ersetzt: Nach „Zurücksetzen“ haben neue Objekte
// neue IDs, die Aufzeichnung passt trotzdem und bekommt die IDs des neuen Laufs zurück.
// K1-b.6: Gestreamte Aufrufe (Frag Reziproq) ebenso, mit eigenen Aufzeichnungen. Gespeichert werden
// die Teile des Streams ohne Rohdaten und Metadaten; beim Abspielen kommen sie in derselben Folge
// wieder, mit kurzer Pause je Teil, damit die Antwort wie live erscheint.

type WrapGenerate = NonNullable<LanguageModelMiddleware['wrapGenerate']>;
type GenerateOptions = Parameters<WrapGenerate>[0];
type GenerateParams = GenerateOptions['params'];
type GenerateResult = Awaited<ReturnType<GenerateOptions['doGenerate']>>;
type WrapStream = NonNullable<LanguageModelMiddleware['wrapStream']>;
type StreamOptions = Parameters<WrapStream>[0];
type StreamResult = Awaited<ReturnType<StreamOptions['doStream']>>;
type StreamPart = StreamResult['stream'] extends ReadableStream<infer Part> ? Part : never;

export type RecordingMode = 'record' | 'replay';

/** Gespeicherte Antwort: was der Aufrufer braucht, ohne Kosten, Kopfzeilen und Rohdaten */
export interface StoredResponse {
  content: GenerateResult['content'];
  finishReason: GenerateResult['finishReason'];
  structuredOutputText?: string;
}

/** Gespeicherter Stream (K1-b.6): die Teile in ihrer Folge, ohne Rohdaten und Metadaten */
export interface StoredStream {
  parts: StreamPart[];
}

export type StoredRecording = StoredResponse | StoredStream;

export interface RecordingStore {
  find(feature: string, inputHash: string): Promise<StoredRecording | null>;
  save(
    feature: string,
    inputHash: string,
    response: StoredRecording,
    modelId: string,
  ): Promise<void>;
}

/** Ohne Aufzeichnung und ohne erreichbares Modell: Der Aufrufer nimmt sein festes Testmodell. */
export class NoRecordingError extends Error {
  override readonly name = 'NoRecordingError';
  constructor() {
    super('Keine Aufzeichnung zu dieser Eingabe und kein Modell erreichbar.');
  }
}

export function isNoRecording(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if ((current as { name?: string }).name === 'NoRecordingError') return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/**
 * Ersetzt jede UUID durch ⟦id1⟧, ⟦id2⟧ … in der Reihenfolge des ersten Auftretens. Mit
 * extend = false nur IDs, die schon bekannt sind (in der Antwort: die IDs der Eingabe); andere
 * bleiben stehen, damit beim Abspielen kein Platzhalter ohne ID übrig bleibt.
 */
export function withPlaceholders(text: string, ids = new Map<string, string>(), extend = true) {
  const replaced = text.replace(uuidPattern, (match) => {
    const id = match.toLowerCase();
    let placeholder = ids.get(id);
    if (!placeholder) {
      if (!extend) return match;
      placeholder = `⟦id${ids.size + 1}⟧`;
      ids.set(id, placeholder);
    }
    return placeholder;
  });
  return { text: replaced, ids };
}

/** Setzt die IDs des aktuellen Aufrufs für die Platzhalter wieder ein. */
export function withIds(text: string, ids: Map<string, string>) {
  let result = text;
  for (const [id, placeholder] of ids) result = result.split(placeholder).join(id);
  return result;
}

/**
 * Hash der Eingabe: Funktion, Nachrichten, Werkzeuge und Antwortformat, IDs als Platzhalter.
 * Gestreamte Aufrufe tragen die Art im Hash; der Hash eines generate-Aufrufs bleibt, wie er war.
 */
export function inputHash(
  feature: string,
  params: GenerateParams,
  kind: 'generate' | 'stream' = 'generate',
) {
  const relevant = {
    feature,
    ...(kind === 'stream' && { kind }),
    prompt: params.prompt,
    tools: (params.tools ?? []).map((tool) => ('name' in tool ? tool.name : tool)),
    toolChoice: params.toolChoice ?? null,
    responseFormat: params.responseFormat ?? null,
  };
  const { text, ids } = withPlaceholders(JSON.stringify(relevant));
  return { hash: createHash('sha256').update(text).digest('hex'), ids };
}

const noUsage: GenerateResult['usage'] = {
  inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 0, text: 0, reasoning: 0 },
};

/** Pause je Teil beim Abspielen eines Streams (K1-b.6): Die Antwort erscheint wie live. */
const replayPauseMs = 15;

/** Modell ohne Anbieter: Im Modus replay ohne Aufzeichnung gibt es nichts zu antworten. */
function absentModel(): LanguageModel {
  const refuse = async () => {
    throw new NoRecordingError();
  };
  return {
    specificationVersion: 'v4',
    provider: 'aufzeichnung',
    modelId: 'aufzeichnung',
    supportedUrls: {},
    doGenerate: refuse,
    doStream: refuse,
  } as unknown as LanguageModel;
}

/**
 * Legt die Zwischenschicht um das Modell. base ist das Modell des Anbieters oder null (Testanbieter
 * ohne Netz); dann kann replay nur aus Aufzeichnungen antworten, record nichts aufzeichnen.
 */
export function recordingModel(
  base: LanguageModel | null,
  mode: RecordingMode,
  feature: string,
  store: RecordingStore,
): LanguageModel | null {
  if (mode === 'record' && (!base || typeof base === 'string')) return base;
  const inner = base && typeof base !== 'string' ? base : absentModel();
  const modelId = typeof inner === 'string' ? inner : inner.modelId;
  const middleware: LanguageModelMiddleware = {
    wrapGenerate: async ({ doGenerate, params }) => {
      const { hash, ids } = inputHash(feature, params);
      if (mode === 'replay') {
        const stored = await store.find(feature, hash);
        if (stored && 'content' in stored) {
          const restored = JSON.parse(withIds(JSON.stringify(stored), ids)) as StoredResponse;
          return {
            content: restored.content,
            finishReason: restored.finishReason,
            ...(restored.structuredOutputText !== undefined && {
              structuredOutputText: restored.structuredOutputText,
            }),
            // Abgespielt: kein Aufruf beim Anbieter, keine Tokens, keine Kosten
            usage: noUsage,
            warnings: [],
          };
        }
      }
      const result = await doGenerate();
      if (mode === 'record') {
        const response: StoredResponse = {
          content: result.content,
          finishReason: result.finishReason,
          ...(result.structuredOutputText !== undefined && {
            structuredOutputText: result.structuredOutputText,
          }),
        };
        const { text } = withPlaceholders(JSON.stringify(response), ids, false);
        await store.save(feature, hash, JSON.parse(text) as StoredResponse, modelId);
      }
      return result;
    },
    wrapStream: async ({ doStream, params }) => {
      const { hash, ids } = inputHash(feature, params, 'stream');
      if (mode === 'replay') {
        const stored = await store.find(feature, hash);
        if (stored && 'parts' in stored) {
          const parts = JSON.parse(withIds(JSON.stringify(stored.parts), ids)) as StreamPart[];
          return {
            stream: simulateReadableStream({
              // Abgespielt: kein Aufruf beim Anbieter, keine Tokens, keine Kosten
              chunks: parts.map((part) =>
                part.type === 'finish' ? { ...part, usage: noUsage } : part,
              ),
              chunkDelayInMs: replayPauseMs,
            }),
          };
        }
      }
      const result = await doStream();
      if (mode !== 'record') return result;
      const parts: StreamPart[] = [];
      let failed = false;
      const recorder = new TransformStream<StreamPart, StreamPart>({
        transform(part, controller) {
          if (part.type === 'error') failed = true;
          else if (part.type !== 'raw' && part.type !== 'response-metadata') parts.push(part);
          controller.enqueue(part);
        },
        async flush() {
          // Nur vollständige Antworten: mit Abschluss und ohne Fehler
          if (failed || !parts.some((part) => part.type === 'finish')) return;
          const { text } = withPlaceholders(JSON.stringify(parts), ids, false);
          await store.save(feature, hash, { parts: JSON.parse(text) as StreamPart[] }, modelId);
        },
      });
      return { ...result, stream: result.stream.pipeThrough(recorder) };
    },
  };
  return wrapLanguageModel({
    model: inner as Parameters<typeof wrapLanguageModel>[0]['model'],
    middleware,
  });
}
