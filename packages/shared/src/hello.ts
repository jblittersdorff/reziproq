import { z } from 'zod';

export const helloQuerySchema = z.object({
  name: z.string().trim().min(1).max(50).default('Welt'),
});

export type HelloQuery = z.infer<typeof helloQuerySchema>;

export const helloResponseSchema = z.object({
  message: z.string(),
});

export type HelloResponse = z.infer<typeof helloResponseSchema>;
