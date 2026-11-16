import { z } from 'zod';
import { cycleStepKeys } from './workspace.js';

// ZYK-04: Stand der Zyklen aller Fokuslieferanten. Schritt, Fälligkeit und Verzug kommen aus
// ZYK-01 und ZYK-02 und werden nirgends gespeichert.

export const cycleStatusSorts = ['verzug', 'termin'] as const;

/** Filter und Sortierung stehen in der Adresse: ?sro=…&bu=…&wg=…&sortierung=termin */
export const cycleStatusQuerySchema = z.object({
  sro: z.string().min(1).max(200).optional(),
  bu: z.uuid().optional(),
  wg: z.uuid().optional(),
  sortierung: z.enum(cycleStatusSorts).optional(),
});
export type CycleStatusQuery = z.infer<typeof cycleStatusQuerySchema>;

export const cycleStatusRowSchema = z.object({
  relationshipId: z.uuid(),
  supplier: z.string(),
  sro: z.string().nullable(),
  /** Ohne aktiven Zyklus false; dann fehlen Schritt und Fälligkeit */
  hasCycle: z.boolean(),
  step: z.enum(cycleStepKeys).nullable(),
  dueDate: z.iso.date().nullable(),
  /** Tage seit der ältesten verpassten Frist; 0 im Plan */
  daysOverdue: z.number().int().nonnegative(),
  jbpDate: z.iso.date().nullable(),
});
export type CycleStatusRow = z.infer<typeof cycleStatusRowSchema>;

const option = z.object({ id: z.string(), name: z.string() });

export const cycleStatusSchema = z.object({
  metrics: z.object({
    total: z.number().int(),
    onTrack: z.number().int(),
    overdue: z.number().int(),
  }),
  rows: z.array(cycleStatusRowSchema),
  options: z.object({
    sros: z.array(option),
    businessUnits: z.array(option),
    materialGroups: z.array(option),
  }),
});
export type CycleStatus = z.infer<typeof cycleStatusSchema>;
