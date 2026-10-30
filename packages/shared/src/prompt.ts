import { z } from 'zod';
import { areas } from './areas.js';
import { supplierSchema } from './suppliers.js';

// Prompt-Fenster (PLT-12): Frage und Antwort leben nur in der laufenden Sitzung im Browser.

export const promptLimits = {
  messages: 20,
  characters: 2000,
} as const;

export const promptRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(promptLimits.characters),
      }),
    )
    .min(1)
    .max(promptLimits.messages)
    .refine((messages) => messages.at(-1)?.role === 'user', {
      message: 'Die letzte Nachricht muss eine Frage sein.',
    }),
});

export type PromptRequest = z.infer<typeof promptRequestSchema>;

const areaPaths = areas.map((area) => area.path) as [string, ...string[]];

/** Ereignisse, die POST /api/prompt als NDJSON streamt, eine Zeile je Ereignis. */
export const promptEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), delta: z.string() }),
  z.object({ type: z.literal('suppliers'), suppliers: z.array(supplierSchema) }),
  z.object({ type: z.literal('navigate'), to: z.enum(areaPaths) }),
  z.object({ type: z.literal('done') }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);

export type PromptEvent = z.infer<typeof promptEventSchema>;
