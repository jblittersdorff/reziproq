import { z } from 'zod';
import { commitmentEvidenceSchema, storedCommitmentEvidenceSchema } from './commitments.js';
import { meetingSides } from './meetings.js';
import { surveyDimensions } from './survey.js';

// QBR-03: Maßnahmen einer Beziehung, geteilt oder intern, mit genau einer Quelle. Seit ZQ-01
// (K2-a.3) sind geteilte Maßnahmen Zusagen und interne Aufgaben (E-K2-1). Diese Schnittstelle
// bedient die alten Maßnahmen-Seiten bis K2-c mit beiden; kind sagt, was ein Eintrag ist.

/** Status einer Aufgabe, wie früher die Maßnahmen */
export const actionStatuses = ['open', 'in_progress', 'done', 'cancelled'] as const;
/** Zusage (geteilt, ZQ-01) oder Aufgabe (intern) */
export const workItemKinds = ['commitment', 'task'] as const;
export type WorkItemKind = (typeof workItemKinds)[number];
/** Status beider Arten: Aufgabe wie actionStatuses, Zusage wie commitmentStatuses (ZQ-01) */
export const workItemStatuses = [
  'open',
  'in_progress',
  'done',
  'cancelled',
  'kept',
  'missed',
  'replaced',
  'withdrawn',
] as const;
export type WorkItemStatus = (typeof workItemStatuses)[number];
export const actionSourceTypes = ['meeting', 'feedback_gap', 'initiative', 'manual'] as const;
/** Was die Oberfläche heute anlegen kann; die übrigen Quellen kommen mit ihren Modulen. */
export const creatableSources = ['manual', 'meeting', 'feedback_gap'] as const;

export type ActionStatus = (typeof actionStatuses)[number];

export const actionItemSchema = z.object({
  id: z.uuid(),
  kind: z.enum(workItemKinds),
  title: z.string(),
  description: z.string().nullable(),
  visibility: z.enum(['internal', 'shared']),
  /** Seite, die die Maßnahme angelegt hat */
  side: z.enum(meetingSides),
  own: z.boolean(),
  ownerSide: z.enum(meetingSides),
  ownerUserId: z.string().nullable(),
  ownerName: z.string(),
  dueDate: z.iso.date(),
  status: z.enum(workItemStatuses),
  /** Beleg einer gehaltenen Zusage (ZQ-01 Regel 2) */
  evidence: storedCommitmentEvidenceSchema.nullable(),
  overdue: z.boolean(),
  sourceType: z.enum(actionSourceTypes),
  sourceId: z.uuid().nullable(),
  /** z. B. der Titel des Termins */
  sourceTitle: z.string().nullable(),
  /** PUL-06: Dimension der Lücke, aus der die Maßnahme stammt */
  sourceDimension: z.enum(surveyDimensions).nullable(),
  /** Inhalt bearbeiten: eigene Seite mit Recht zum Bearbeiten */
  canEdit: z.boolean(),
  /** Status ändern: beide Seiten bei geteilten, die eigene bei internen */
  canChangeStatus: z.boolean(),
});

export const actionListSchema = z.object({
  actions: z.array(actionItemSchema),
  canCreate: z.boolean(),
  /** Personen der eigenen Seite für „verantwortlich“ */
  people: z.array(z.object({ userId: z.string(), name: z.string() })),
});

const title = z.string().trim().min(1).max(200);

export const saveActionSchema = z
  .object({
    title,
    description: z.string().trim().max(4000).nullable(),
    visibility: z.enum(['internal', 'shared']),
    ownerSide: z.enum(meetingSides),
    /** Person der eigenen Seite; bei der anderen Seite null und dafür ownerName */
    ownerUserId: z.string().min(1).nullable(),
    ownerName: z.string().trim().max(120).nullable(),
    dueDate: z.iso.date(),
  })
  .strict()
  .refine((value) => value.ownerUserId !== null || (value.ownerName ?? '').length > 0, {
    message: 'Verantwortliche Person fehlt',
    path: ['ownerName'],
  });

export const createActionSchema = z
  .object({
    action: saveActionSchema,
    sourceType: z.enum(creatableSources),
    sourceId: z.uuid().nullable(),
  })
  .strict()
  .refine((value) => (value.sourceType === 'manual') === (value.sourceId === null), {
    message: 'Genau eine Quelle',
    path: ['sourceId'],
  });

/** Status je Art; „gehalten“ einer Zusage braucht einen Beleg (sonst 422 beleg_fehlt) */
export const actionStatusSchema = z
  .object({ status: z.enum(workItemStatuses), evidence: commitmentEvidenceSchema.optional() })
  .strict();

/** /start/massnahmen: offene Maßnahmen aller eigenen Beziehungen (QBR-03). */
export const myActionsSchema = z.object({
  items: z.array(
    actionItemSchema.extend({
      relationshipId: z.uuid(),
      counterpart: z.string(),
      href: z.string(),
    }),
  ),
});

export type ActionItem = z.infer<typeof actionItemSchema>;
export type ActionList = z.infer<typeof actionListSchema>;
export type SaveAction = z.infer<typeof saveActionSchema>;
export type CreateAction = z.infer<typeof createActionSchema>;
export type ActionStatusChange = z.infer<typeof actionStatusSchema>;
export type MyActions = z.infer<typeof myActionsSchema>;

/** QBR-04: Erinnerungstage je Organisation, für Käufer und Lieferanten. */
export const defaultActionReminderDays = 3;
export const actionReminderSettingSchema = z
  .object({ reminderDays: z.number().int().min(1).max(30) })
  .strict();
export type ActionReminderSetting = z.infer<typeof actionReminderSettingSchema>;
