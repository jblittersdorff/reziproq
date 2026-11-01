import {
  auditResponseSchema,
  type CreateSupplierRequest,
  createSupplierResponseSchema,
  customersResponseSchema,
  type ForbiddenCode,
  forbiddenCodes,
  healthResponseSchema,
  meResponseSchema,
  organizationMemberSchema,
  organizationResponseSchema,
  type PromptEvent,
  type PromptRequest,
  permissionsResponseSchema,
  promptEventSchema,
  type SpendRequest,
  supplierDetailSchema,
  supplierLookupResponseSchema,
  supplierOverviewSchema,
  suppliersResponseSchema,
  supportHeader,
  teamResponseSchema,
  type UpdateMemberRequest,
  type UpdateSupplierRequest,
  type UpdateTeamRequest,
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
    /** Antwort der API bei Fehlern, z. B. Feldfehler (400) oder vorhandene Beziehung (409) */
    readonly body?: unknown,
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

// 401, 403 und 404 ändern sich durch Wiederholen nicht.
const retryUnlessDenied = (failureCount: number, error: Error) =>
  !(error instanceof ApiError && [401, 403, 404].includes(error.status)) && failureCount < 2;

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

/** Was die Person darf, als Liste von Aktionen aus can() im Backend (PLT-05). */
export const permissionsQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['me', 'permissions'],
    queryFn: () => getJson('/me/permissions', permissionsResponseSchema, accessToken),
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

export const organizationQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['organisation'],
    queryFn: () => getJson('/organisation', organizationResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** Verlauf eines Objekts (PLT-08), neueste zuerst. */
export const auditQueryOptions = (accessToken: string, objectType: string, objectId: string) =>
  queryOptions({
    queryKey: ['audit', objectType, objectId],
    queryFn: () =>
      getJson(
        `/audit?${new URLSearchParams({ object_type: objectType, object_id: objectId })}`,
        auditResponseSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

/** Ein Mitglied der eigenen Organisation mit Rolle (PLT-05). */
export const memberQueryOptions = (accessToken: string, userId: string) =>
  queryOptions({
    queryKey: ['organisation', 'mitglieder', userId],
    queryFn: () =>
      getJson(
        `/organisation/mitglieder/${encodeURIComponent(userId)}`,
        organizationMemberSchema,
        accessToken,
      ),
    retry: retryUnlessDenied,
  });

/** Schreibt über die API und prüft die Antwort; Fehler kommen mit Status und Antwort zurück. */
async function sendJson<T extends z.ZodType>(
  method: 'POST' | 'PATCH' | 'PUT',
  path: string,
  body: unknown,
  schema: T,
  accessToken: string,
): Promise<z.output<T>> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...supportHeaders(),
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) {
    const answer: unknown = await res
      .clone()
      .json()
      .catch(() => null);
    throw new ApiError(path, res.status, await forbiddenCode(res), answer);
  }
  return schema.parse(await res.json());
}

/** Ein Lieferant mit Stammdaten, eigenen Werten und Spend je Jahr (PLT-03b). */
export const supplierQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId],
    queryFn: () => getJson(`/suppliers/${relationshipId}`, supplierDetailSchema, accessToken),
    retry: retryUnlessDenied,
  });

/** Ist ein Lieferant mit dieser USt-IdNr. oder D-U-N-S schon in Reziproq? Nur ja oder nein. */
export const lookupSupplier = (accessToken: string, query: { ust?: string; duns?: string }) =>
  getJson(
    `/suppliers/lookup?${new URLSearchParams(
      Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])),
    )}`,
    supplierLookupResponseSchema,
    accessToken,
  );

export const createSupplier = (accessToken: string, request: CreateSupplierRequest) =>
  sendJson('POST', '/suppliers', request, createSupplierResponseSchema, accessToken);

export const updateSupplier = (
  accessToken: string,
  relationshipId: string,
  request: UpdateSupplierRequest,
) => sendJson('PATCH', `/suppliers/${relationshipId}`, request, supplierDetailSchema, accessToken);

export const endSupplier = (accessToken: string, relationshipId: string) =>
  sendJson('POST', `/suppliers/${relationshipId}/beenden`, {}, supplierDetailSchema, accessToken);

export const putSpend = (
  accessToken: string,
  relationshipId: string,
  year: number,
  request: SpendRequest,
) =>
  sendJson(
    'PUT',
    `/suppliers/${relationshipId}/spend/${year}`,
    request,
    supplierDetailSchema,
    accessToken,
  );

export const updateMember = (accessToken: string, userId: string, request: UpdateMemberRequest) =>
  sendJson(
    'PUT',
    `/organisation/mitglieder/${encodeURIComponent(userId)}`,
    request,
    organizationMemberSchema,
    accessToken,
  );

/** Internes Team einer Beziehung (PLT-05b). */
/** Kopf und Kennzahlen des Arbeitsbereichs (NAV-06); neu geladen mit allem unter ['suppliers', id]. */
export const supplierOverviewQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'overview'],
    queryFn: () =>
      getJson(`/suppliers/${relationshipId}/overview`, supplierOverviewSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const teamQueryOptions = (accessToken: string, relationshipId: string) =>
  queryOptions({
    queryKey: ['suppliers', relationshipId, 'team'],
    queryFn: () => getJson(`/suppliers/${relationshipId}/team`, teamResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });

export const updateTeam = (
  accessToken: string,
  relationshipId: string,
  request: UpdateTeamRequest,
) => sendJson('PUT', `/suppliers/${relationshipId}/team`, request, teamResponseSchema, accessToken);

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
