import { z } from 'zod';
import { meetingSides } from './meetings.js';

// QBR-03: Maßnahmen einer Beziehung, geteilt oder intern, mit genau einer Quelle.

export const actionStatuses = ['open', 'in_progress', 'done', 'cancelled'] as const;
export const actionSourceTypes = ['meeting', 'feedback_gap', 'initiative', 'manual'] as const;
/** Was die Oberfläche heute anlegen kann; die übrigen Quellen kommen mit ihren Modulen. */
export const creatableSources = ['manual', 'meeting'] as const;

export type ActionStatus = (typeof actionStatuses)[number];

export const actionItemSchema = z.object({
  id: z.uuid(),
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
  status: z.enum(actionStatuses),
  overdue: z.boolean(),
  sourceType: z.enum(actionSourceTypes),
  sourceId: z.uuid().nullable(),
  /** z. B. der Titel des Termins */
  sourceTitle: z.string().nullable(),
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

export const actionStatusSchema = z.object({ status: z.enum(actionStatuses) }).strict();

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
