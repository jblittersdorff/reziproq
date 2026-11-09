import { z } from 'zod';
import { meetingSides } from './meetings.js';

// JBP-01: Vorbereitung des Joint Business Planning. Die Agenda-Punkte tragen ihren Abschnitt, damit
// die Vorbereitung je Punkt zeigt, ob er bereit ist.

export const jbpSections = [
  'buyer_update',
  'supplier_update',
  'topics',
  'initiatives',
  'commitments',
  'scorecard',
] as const;
export type JbpSection = (typeof jbpSections)[number];

export const jbpPreparationSchema = z.object({
  jbp: z
    .object({
      id: z.uuid(),
      version: z.number().int(),
      status: z.enum(['draft', 'in_review', 'approved']),
    })
    .nullable(),
  /** Anlegen: SRO oder Admin beim Käufer, solange es keinen Plan gibt */
  canCreate: z.boolean(),
  /** Termin aus dem Zyklus (ZYK-02), nur beim Käufer */
  suggestedDate: z.iso.date().nullable(),
  meeting: z
    .object({
      id: z.uuid(),
      title: z.string(),
      startsAt: z.iso.datetime({ offset: true }),
      location: z.string().nullable(),
      participants: z.array(z.string()),
    })
    .nullable(),
  agenda: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      side: z.enum(meetingSides),
      section: z.enum(jbpSections).nullable(),
      /** bereit, fehlt, oder null für Punkte ohne Abschnitt */
      ready: z.boolean().nullable(),
    }),
  ),
  /** Live aus ihrem Ort: Spielregeln nur, wenn geteilt (SEG-10); Feedback folgt mit Block F */
  live: z.object({
    rules: z.object({ typeName: z.string(), sharedAt: z.string() }).nullable(),
  }),
  updates: z.object({
    buyer: z.object({ text: z.string(), updatedAt: z.string() }).nullable(),
    supplier: z.object({ text: z.string(), updatedAt: z.string() }).nullable(),
  }),
  ownSide: z.enum(meetingSides),
  canEditOwnUpdate: z.boolean(),
  /** Nur beim Käufer: Ist der Lieferantenplan freigegeben? Der Lieferant sieht das nie. */
  buyerHint: z.object({ supplierPlanApproved: z.boolean() }).nullable(),
});
export type JbpPreparation = z.infer<typeof jbpPreparationSchema>;

export const createJbpSchema = z
  .object({
    startsAt: z.iso.datetime({ offset: true }),
    location: z.string().trim().max(300).nullable(),
    locale: z.enum(['de', 'en']).default('de'),
  })
  .strict();
export type CreateJbp = z.infer<typeof createJbpSchema>;

export const saveBusinessUpdateSchema = z
  .object({ text: z.string().trim().max(10_000) })
  .strict();
export type SaveBusinessUpdate = z.infer<typeof saveBusinessUpdateSchema>;
