import {
  type ForbiddenCode,
  forbiddenCodes,
  healthResponseSchema,
  meResponseSchema,
  suppliersResponseSchema,
} from '@reziproq/shared';
import { queryOptions } from '@tanstack/react-query';
import type { z } from 'zod';

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

async function getJson<T extends z.ZodType>(
  path: string,
  schema: T,
  accessToken?: string,
): Promise<z.output<T>> {
  const res = await fetch(
    `/api${path}`,
    accessToken ? { headers: { authorization: `Bearer ${accessToken}` } } : {},
  );
  if (!res.ok) throw new ApiError(path, res.status, await forbiddenCode(res));
  return schema.parse(await res.json());
}

export const healthQueryOptions = () =>
  queryOptions({
    queryKey: ['health'],
    queryFn: () => getJson('/health', healthResponseSchema),
  });

export const meQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['me', accessToken],
    queryFn: () => getJson('/me', meResponseSchema, accessToken),
    // Ein 401 ändert sich durch Wiederholen nicht.
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 401) && failureCount < 2,
  });

async function forbiddenCode(res: Response): Promise<ForbiddenCode | undefined> {
  if (res.status !== 403) return undefined;
  const body: unknown = await res.json().catch(() => null);
  const code = (body as { code?: unknown } | null)?.code;
  return forbiddenCodes.find((known) => known === code);
}

// 401 und 403 ändern sich durch Wiederholen nicht.
const retryUnlessDenied = (failureCount: number, error: Error) =>
  !(error instanceof ApiError && (error.status === 401 || error.status === 403)) &&
  failureCount < 2;

export const suppliersQueryOptions = (accessToken: string) =>
  queryOptions({
    queryKey: ['suppliers', accessToken],
    queryFn: () => getJson('/suppliers', suppliersResponseSchema, accessToken),
    retry: retryUnlessDenied,
  });
