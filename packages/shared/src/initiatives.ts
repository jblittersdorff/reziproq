import { z } from 'zod';
import { personSchema } from './commitments.js';
import { meetingSides } from './meetings.js';

// JBP-03: Gemeinsame Initiativen mit Meilensteinen und Roadmap, für beide Seiten gleich.

export const initiativeStatuses = ['planned', 'running', 'done', 'stopped'] as const;
export type InitiativeStatus = (typeof initiativeStatuses)[number];

export const initiativeMilestoneSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  dueOn: z.iso.date(),
  doneOn: z.iso.date().nullable(),
});
export type InitiativeMilestone = z.infer<typeof initiativeMilestoneSchema>;

export const initiativeSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  goal: z.string(),
  benefitBuyer: z.string(),
  benefitSupplier: z.string(),
  ownerBuyerName: z.string(),
  ownerSupplierName: z.string(),
  /** Gewählte Person je Seite (JBP-05); null, solange nur ein Name eingetragen ist */
  ownerBuyerUserId: z.string().nullable(),
  ownerSupplierUserId: z.string().nullable(),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  status: z.enum(initiativeStatuses),
  milestones: z.array(initiativeMilestoneSchema),
  /** Herkunfts-Themen aus dem Zusammenführen (JBP-02) */
  topics: z.array(z.object({ id: z.uuid(), title: z.string(), side: z.enum(meetingSides) })),
});
export type Initiative = z.infer<typeof initiativeSchema>;

export const initiativesSchema = z.object({
  /** Ohne Gemeinsamen Plan gibt es noch keine Initiativen */
  hasPlan: z.boolean(),
  /** Freigegebener Plan (JBP-06): nur noch Status und Meilensteine änderbar */
  approved: z.boolean(),
  canEdit: z.boolean(),
  ownSide: z.enum(meetingSides),
  /** Personen der eigenen Seite für die Verantwortung (JBP-05) */
  people: z.array(personSchema),
  initiatives: z.array(initiativeSchema),
});
export type Initiatives = z.infer<typeof initiativesSchema>;

export const initiativeDetailSchema = z.object({
  initiative: initiativeSchema,
  approved: z.boolean(),
  canEdit: z.boolean(),
  ownSide: z.enum(meetingSides),
  people: z.array(personSchema),
});
export type InitiativeDetail = z.infer<typeof initiativeDetailSchema>;

const text = (max: number) => z.string().trim().min(1).max(max);

export const saveInitiativeSchema = z
  .object({
    title: text(200),
    goal: text(2000),
    // Nutzen für beide Seiten ist Pflicht (JBP-03).
    benefitBuyer: text(2000),
    benefitSupplier: text(2000),
    /** Name je Seite; die andere Seite nur beim Anlegen, danach pflegt sie ihn selbst */
    ownerBuyerName: text(200),
    ownerSupplierName: text(200),
    /** Verantwortliche Person der eigenen Seite (JBP-05); ihr Name ersetzt den eigenen Namen */
    ownerUserId: z.string().min(1).nullable().optional(),
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
    /** Beim Zusammenführen: Themen beider Seiten, die in die Initiative eingehen */
    topicIds: z.array(z.uuid()).max(20).optional(),
  })
  .strict()
  .refine((value) => value.endsOn >= value.startsOn, {
    path: ['endsOn'],
    message: 'ende_vor_beginn',
  });
export type SaveInitiative = z.infer<typeof saveInitiativeSchema>;

export const initiativeStatusSchema = z.object({ status: z.enum(initiativeStatuses) }).strict();
export type SetInitiativeStatus = z.infer<typeof initiativeStatusSchema>;

export const saveMilestoneSchema = z
  .object({
    title: text(200),
    dueOn: z.iso.date(),
    doneOn: z.iso.date().nullable(),
  })
  .strict();
export type SaveMilestone = z.infer<typeof saveMilestoneSchema>;
