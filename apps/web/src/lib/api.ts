import {
  customersResponseSchema,
  type ForbiddenCode,
  forbiddenCodes,
  healthResponseSchema,
  meResponseSchema,
  type PromptEvent,
  type PromptRequest,
  promptEventSchema,
  suppliersResponseSchema,
  supportHeader,
} from '@reziproq/shared';
import { queryOptions } from '@tanstack/react-query';
import type { z } from 'zod';
import { getSupportCustomer } from './support';

export class ApiError extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
    /** Bei 403: warum, damit die Oberfläche den passenden Hinweis zeigt. */
    readonly code?: ForbiddenCode,
  ) {
    super(`Anfrage an ${path} fehlgeschlagen (${status})`);
  }
}

/** In der Betreiber-Ansicht schickt jede Anfrage den gewählten Kunden mit (PLT-13). */
function supportHeaders(): Record<string, string> {
  const customer = getSupportCustomer();
  return customer ? { [supportHeader]: customer.id } : {};
}

async function getJson<T extends z.ZodType>(
  path: string,
  schema: T,
  accessToken?: string,
): Promise<z.output<T>> {
  const res = await fetch(`/api${path}`, {
    headers: {
      ...supportHeaders(),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  if (!res.ok) throw new ApiError(path, res.status, await forbiddenCode(res));
  return schema.parse(await res.json());
}

// 401 und 403 ändern sich durch Wiederholen nicht.
const retryUnlessDenied = (failureCount: number, error: Error) =>
  !(error instanceof ApiError && (error.status === 401 || error.status === 403)) &&
  failureCount < 2;

export const healthQueryOptions = () =>
  queryOptions({
    queryKey: ['health'],
    queryFn: () => getJson('/health', healthResponseSchema),
  });

// Das Token gehört nicht in den Schlüssel: Erneuert es sich im Hintergrund, soll nichts neu laden
// und keine Seite kurz leer werden, sonst gehen Eingaben verloren (PLT-01). Abfragen nutzen beim
// nächsten Laden trotzdem das aktuelle Token. Ein anderer Nutzer heißt immer neu laden, weil
// Tokens nur im Speicher liegen; den Wechsel des Kunden leert use-support-switch.ts.
export const meQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['me'],
    queryFn: () => getJson('/me', meResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

/**
 * Meldet der API eine abgeschlossene Anmeldung; sie setzt last_login_at (PLT-01).
 * Scheitert das, geht es trotzdem weiter: Die Anmeldung selbst ist gültig.
 */
export async function reportLogin(accessToken: string): Promise<void> {
  try {
    await fetch('/api/me/anmeldung', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
  } catch {}
}

async function forbiddenCode(res: Response): Promise<ForbiddenCode | undefined> {
  if (res.status !== 403) return undefined;
  const body: unknown = await res.json().catch(() => null);
  const code = (body as { code?: unknown } | null)?.code;
  return forbiddenCodes.find((known) => known === code);
}

export const suppliersQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['suppliers'],
    queryFn: () => getJson('/suppliers', suppliersResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

/**
 * Stellt eine Frage an das Prompt-Fenster (PLT-12) und meldet jedes Ereignis der gestreamten
 * Antwort, sobald seine Zeile vollständig angekommen ist.
 */
export async function streamPrompt(
  accessToken: string,
  messages: PromptRequest['messages'],
  onEvent: (event: PromptEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/prompt', {
    method: 'POST',
    headers: {
      ...supportHeaders(),
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ messages }),
    signal,
  });
  if (!res.ok || !res.body) throw new ApiError('/prompt', res.status, await forbiddenCode(res));

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) onEvent(promptEventSchema.parse(JSON.parse(line)));
    }
  }
  if (buffer.trim()) onEvent(promptEventSchema.parse(JSON.parse(buffer)));
}

export const customersQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['betreiber-kunden'],
    queryFn: () => getJson('/betreiber/kunden', customersResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });
