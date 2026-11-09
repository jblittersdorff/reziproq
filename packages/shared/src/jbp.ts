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

// JBP-02: Themen beider Seiten. Der Lieferant sieht nur Titel und teilbare Beschreibung.

export const jbpTopicSchema = z.object({
  id: z.uuid(),
  side: z.enum(meetingSides),
  own: z.boolean(),
  title: z.string(),
  description: z.string(),
  priority: z.number().int(),
  status: z.enum(['proposed', 'merged', 'parked']),
  parkReason: z.string().nullable(),
  /** Nur beim Käufer: aus welchem internen Thema des Lieferantenplans (SPL-06) */
  origin: z.object({ title: z.string() }).nullable(),
});
export type JbpTopic = z.infer<typeof jbpTopicSchema>;

export const jbpTopicsSchema = z.object({
  /** Ohne Gemeinsamen Plan gibt es noch keine Themen */
  hasPlan: z.boolean(),
  ownSide: z.enum(meetingSides),
  buyer: z.array(jbpTopicSchema),
  supplier: z.array(jbpTopicSchema),
  canEditOwn: z.boolean(),
  /** SRO oder Admin beim Käufer: aus dem Lieferantenplan übernehmen */
  canImport: z.boolean(),
});
export type JbpTopics = z.infer<typeof jbpTopicsSchema>;

export const saveJbpTopicSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000),
  })
  .strict();
export type SaveJbpTopic = z.infer<typeof saveJbpTopicSchema>;

export const parkJbpTopicSchema = z
  .object({ reason: z.string().trim().min(1).max(500) })
  .strict();
export type ParkJbpTopic = z.infer<typeof parkJbpTopicSchema>;

export const jbpTopicOrderSchema = z.object({ ids: z.array(z.uuid()).min(1).max(100) }).strict();
export type JbpTopicOrder = z.infer<typeof jbpTopicOrderSchema>;

/** Interne Themen des Lieferantenplans, die noch nicht übernommen sind (nur Käufer). */
export const jbpTopicCandidatesSchema = z.object({
  candidates: z.array(z.object({ id: z.uuid(), title: z.string(), reason: z.string() })),
});
export type JbpTopicCandidates = z.infer<typeof jbpTopicCandidatesSchema>;

export const importJbpTopicsSchema = z
  .object({
    items: z
      .array(
        z.object({
          strategicTopicId: z.uuid(),
          /** Die teilbare Beschreibung; die Begründung bleibt intern */
          description: z.string().trim().max(2000),
        }),
      )
      .min(1)
      .max(20),
  })
  .strict();
export type ImportJbpTopics = z.infer<typeof importJbpTopicsSchema>;
