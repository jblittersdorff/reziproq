import { z } from 'zod';
import { formatCadences, formatLevels, localizedTextSchema } from './playbook.js';

// PLB-06: Kontaktpunkte. Wer bei uns mit wem beim Lieferanten auf welcher Ebene, in welchem
// Format und wie oft spricht. Ebenen und Takte wie bei den Formaten der Spielregeln (PLB-03).

export const touchpointErrors = ['contact_internal_only', 'person_required'] as const;
export type TouchpointError = (typeof touchpointErrors)[number];

const name = z.string().trim().min(1).max(120);

export const touchpointSchema = z.object({
  id: z.uuid(),
  visibility: z.enum(['internal', 'shared']),
  buyerUserId: z.string().nullable(),
  buyerName: z.string(),
  buyerLevel: z.enum(formatLevels),
  supplierContactId: z.uuid().nullable(),
  supplierName: z.string(),
  supplierLevel: z.enum(formatLevels),
  format: z.string(),
  cadence: z.enum(formatCadences),
  notes: z.string().nullable(),
});
export type Touchpoint = z.infer<typeof touchpointSchema>;

export const touchpointListSchema = z.object({
  touchpoints: z.array(touchpointSchema),
  /** Vereinbarte Formate (freigegebene Spielregeln) ohne Kontaktpunkt gleichen Namens */
  gaps: z.array(
    z.object({ title: localizedTextSchema(200), level: z.enum(formatLevels).nullable() }),
  ),
  /** Formate der Spielregeln als Vorschlag beim Anlegen */
  formats: z.array(
    z.object({
      title: localizedTextSchema(200),
      level: z.enum(formatLevels).nullable(),
      cadence: z.enum(formatCadences),
    }),
  ),
  /** Personen der eigenen Organisation und Kontakte des Lieferanten (nur beim Käufer) */
  people: z.array(z.object({ userId: z.string(), name: z.string() })),
  contacts: z.array(z.object({ id: z.uuid(), name: z.string() })),
  canEdit: z.boolean(),
  /** Geprüft im laufenden Zyklus; null ohne Prüfung. Nur beim Käufer. */
  review: z.object({ reviewedAt: z.string(), reviewedByName: z.string() }).nullable(),
  /** Ob es einen laufenden Zyklus gibt, in dem geprüft werden kann */
  canReview: z.boolean(),
});
export type TouchpointList = z.infer<typeof touchpointListSchema>;

export const saveTouchpointSchema = z
  .object({
    visibility: z.enum(['internal', 'shared']),
    buyerUserId: z.string().min(1).nullable(),
    buyerName: name.nullable(),
    buyerLevel: z.enum(formatLevels),
    supplierContactId: z.uuid().nullable(),
    supplierName: name.nullable(),
    supplierLevel: z.enum(formatLevels),
    format: name,
    cadence: z.enum(formatCadences),
    notes: z.string().trim().max(1000).nullable(),
  })
  .strict()
  .refine((input) => input.buyerUserId !== null || input.buyerName !== null, {
    message: 'person_required',
    path: ['buyerName'],
  })
  .refine((input) => input.supplierContactId !== null || input.supplierName !== null, {
    message: 'person_required',
    path: ['supplierName'],
  })
  .refine((input) => input.visibility === 'internal' || input.supplierContactId === null, {
    message: 'contact_internal_only',
    path: ['supplierContactId'],
  });
export type SaveTouchpoint = z.infer<typeof saveTouchpointSchema>;
