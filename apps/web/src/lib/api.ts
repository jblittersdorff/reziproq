import { type HelloQuery, helloResponseSchema } from '@reziproq/shared';
import { queryOptions } from '@tanstack/react-query';
import type { z } from 'zod';

async function getJson<T extends z.ZodType>(path: string, schema: T): Promise<z.output<T>> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`Anfrage an ${path} fehlgeschlagen (${res.status})`);
  return schema.parse(await res.json());
}

export const helloQueryOptions = (query: Partial<HelloQuery> = {}) =>
  queryOptions({
    queryKey: ['hello', query],
    queryFn: () => getJson(`/hello?${new URLSearchParams(query).toString()}`, helloResponseSchema),
  });
