import { z } from 'zod';

// NAV-05: Start zeigt, was für die Person fällig ist. Jedes Modul meldet seine Aufgaben als DueItem.

export const dueKinds = ['rating', 'cycle', 'contribution'] as const;

export const dueItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(dueKinds),
  supplier: z.string(),
  // Zusatz zum Titel, z. B. die Business Unit.
  detail: z.string().nullable(),
  dueDate: z.iso.date(),
  href: z.string(),
});

export const dueListSchema = z.object({ items: z.array(dueItemSchema) });

export const startRelationshipSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  // Soll-Typ aus der Konsolidierung (SEG-06); null, solange nichts entschieden ist
  target: z.string().nullable(),
});

export const startSchema = z.object({
  due: z.object({ items: z.array(dueItemSchema), total: z.number().int() }),
  relationships: z.object({
    items: z.array(startRelationshipSchema),
    total: z.number().int(),
  }),
});

export type DueItem = z.infer<typeof dueItemSchema>;
export type DueList = z.infer<typeof dueListSchema>;
export type StartData = z.infer<typeof startSchema>;
