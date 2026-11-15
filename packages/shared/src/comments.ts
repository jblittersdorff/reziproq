import { z } from 'zod';

// QS-02: Kommentare an Initiativen, Zusagen, Maßnahmen, Terminen, Themen und Spielregeln.
// Geteilt oder intern; Personen erwähnen, die das Objekt und den Kommentar sehen dürfen.

export const commentObjectTypes = [
  'initiative',
  'commitment',
  'action',
  'meeting',
  'topic',
  'rule_set',
] as const;
export const commentObjectTypeSchema = z.enum(commentObjectTypes);
export type CommentObjectType = z.infer<typeof commentObjectTypeSchema>;

/** Wie lange der Verfasser seinen Kommentar bearbeiten darf */
export const commentEditHours = 24;
export const commentMaxLength = 2000;

export const commentPersonSchema = z.object({
  userId: z.string().min(1),
  name: z.string(),
  side: z.enum(['buyer', 'supplier']),
});
export type CommentPerson = z.infer<typeof commentPersonSchema>;

export const commentSchema = z.object({
  id: z.uuid(),
  side: z.enum(['buyer', 'supplier']),
  visibility: z.enum(['internal', 'shared']),
  authorName: z.string(),
  own: z.boolean(),
  /** Leer, wenn der Kommentar entfernt wurde */
  body: z.string().nullable(),
  mentions: z.array(commentPersonSchema),
  createdAt: z.iso.datetime({ offset: true }),
  editedAt: z.iso.datetime({ offset: true }).nullable(),
  deletedAt: z.iso.datetime({ offset: true }).nullable(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});
export type Comment = z.infer<typeof commentSchema>;

export const commentListSchema = z.object({
  comments: z.array(commentSchema),
  canComment: z.boolean(),
  /** Ist das Objekt intern, sind auch seine Kommentare intern. */
  objectVisibility: z.enum(['internal', 'shared']),
  /** Wen man erwähnen darf: intern nur die eigene Seite, geteilt beide */
  people: z.object({
    internal: z.array(commentPersonSchema),
    shared: z.array(commentPersonSchema),
  }),
});
export type CommentList = z.infer<typeof commentListSchema>;

const commentBody = z.string().trim().min(1).max(commentMaxLength);

export const saveCommentSchema = z.object({
  visibility: z.enum(['internal', 'shared']),
  body: commentBody,
  mentions: z.array(z.string().min(1)).max(20).default([]),
});
export type SaveComment = z.infer<typeof saveCommentSchema>;

export const editCommentSchema = z.object({ body: commentBody });
export type EditComment = z.infer<typeof editCommentSchema>;
