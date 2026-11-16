import { z } from 'zod';
import { nextMeetingSchema } from './meetings.js';

// NAV-05: Start zeigt, was für die Person fällig ist. Jedes Modul meldet seine Aufgaben als DueItem.

export const dueKinds = [
  'rating',
  'cycle',
  'contribution',
  'action',
  'approval',
  'commitment',
  'milestone',
  'review',
  'signature',
  'validation',
  // QS-02: Erwähnung in einem Kommentar, bis sie geöffnet wurde
  'mention',
] as const;

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
  /** Nächster Termin aus den eigenen Beziehungen (QBR-01b); null ohne geplanten Termin */
  nextMeeting: nextMeetingSchema.nullable(),
  /** Zahlen und Fokuslieferanten für die Kacheln (Handschrift Bühne, A2); nur beim Käufer */
  portfolio: z
    .object({
      suppliers: z.number().int(),
      focusTotal: z.number().int(),
      openDecisions: z.number().int(),
      focus: z.array(z.object({ id: z.uuid(), name: z.string(), rulesShared: z.boolean() })),
    })
    .nullable(),
  /** Offene Maßnahmen der eigenen Beziehungen (QBR-03) */
  openActions: z.number().int(),
  /** FS-01: offene Hinweise der Organisation, nur beim Käufer */
  openHints: z.number().int().optional(),
});

export type DueItem = z.infer<typeof dueItemSchema>;
export type DueList = z.infer<typeof dueListSchema>;
export type StartData = z.infer<typeof startSchema>;
