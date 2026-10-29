import { z } from 'zod';

/** Die angemeldete Person, wie sie im Access Token steht. */
export const meResponseSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
