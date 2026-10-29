import { healthResponseSchema, meResponseSchema } from '@reziproq/shared';
import { queryOptions } from '@tanstack/react-query';
import type { z } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly path: string,
    readonly status: number,
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
  if (!res.ok) throw new ApiError(path, res.status);
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
