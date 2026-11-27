import { z } from 'zod';

// IN-04: Wichtige Mails mit Lieferanten ablegen, über das Outlook-Add-in oder per Weiterleitung.
// Nur die Käuferseite sieht sie; „Nur ich“ (private) nur die Person, die sie abgelegt hat.

export const filedMailVisibilities = ['team', 'private'] as const;
export type FiledMailVisibility = (typeof filedMailVisibilities)[number];
export const filedMailSources = ['addin', 'forward'] as const;

/** Anhänge über dieser Größe werden nicht gespeichert, nur genannt. */
export const maxAttachmentBytes = 25 * 1024 * 1024;

/** Outlook-Add-in in einer gelesenen Mail: Absender und Empfänger, um den Lieferanten zu finden */
export const mailDetectRequestSchema = z.object({
  from: z.email(),
  to: z.array(z.email()).max(200).default([]),
  cc: z.array(z.email()).max(200).default([]),
});
export type MailDetectRequest = z.input<typeof mailDetectRequestSchema>;

/** „In Reziproq ablegen“: die Mail kommt über Microsoft Graph, nur diese eine, nur auf Klick */
export const fileMailRequestSchema = z
  .object({
    // ID der Nachricht im Postfach (Office.js item.itemId, für Graph umgewandelt)
    itemId: z.string().trim().min(1).max(1000),
    relationshipId: z.uuid(),
    visibility: z.enum(filedMailVisibilities).default('team'),
  })
  .strict();
export type FileMailRequest = z.input<typeof fileMailRequestSchema>;

export const fileMailResultSchema = z.object({
  // false: diese Mail war bei dem Lieferanten schon abgelegt
  created: z.boolean(),
  mailId: z.uuid().nullable(),
  href: z.string(),
});
export type FileMailResult = z.infer<typeof fileMailResultSchema>;

export const filedMailAttachmentSchema = z.object({
  id: z.uuid(),
  fileName: z.string(),
  mime: z.string(),
  size: z.number().int(),
  // false: zu groß, nicht gespeichert
  stored: z.boolean(),
});

/** Eine abgelegte Mail im Verlauf; der Text kommt erst beim Aufklappen */
export const filedMailSummarySchema = z.object({
  id: z.uuid(),
  fromEmail: z.string(),
  fromName: z.string().nullable(),
  sentAt: z.string(),
  // Zwei Sätze von Reziproq (Entwurf); null, wenn keine gültige Zusammenfassung entstand
  summary: z.string().nullable(),
  source: z.enum(filedMailSources),
  attachments: z.array(filedMailAttachmentSchema),
});
export type FiledMailSummary = z.infer<typeof filedMailSummarySchema>;

export const filedMailBodySchema = z.object({
  id: z.uuid(),
  subject: z.string(),
  toEmails: z.array(z.string()),
  bodyText: z.string(),
});
export type FiledMailBody = z.infer<typeof filedMailBodySchema>;

// PO-01 (K2-d.3b): Entwurf „Zusagen aus Mail“ zum Prüfen und Anpassen; freigeben kommt mit K2-d.4

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const mailCommitmentSchema = z.object({
  title: z.string(),
  side: z.enum(['buyer', 'supplier']),
  ownerName: z.string(),
  /** Person der eigenen Seite mit Konto; beim Lieferanten null */
  ownerUserId: z.string().nullable(),
  dueOn: isoDay.nullable(),
  quote: z.string(),
  /** Textstelle im Mailtext, [Anfang, Ende) */
  span: z.tuple([z.number().int(), z.number().int()]).nullable(),
  /** Offene Zusage, die diese ersetzt (E-K2-2) */
  replaces: z.object({ id: z.uuid(), title: z.string(), dueOn: isoDay }).nullable(),
});
export type MailCommitment = z.infer<typeof mailCommitmentSchema>;

export const mailCommitmentsViewSchema = z.object({
  draftId: z.uuid(),
  status: z.enum(['draft', 'accepted', 'discarded']),
  createdAt: z.string(),
  relationship: z.object({ id: z.uuid(), name: z.string() }),
  /** Name der eigenen Organisation („Antwort im Ton von …“) */
  ownOrganization: z.string(),
  mail: z.object({
    id: z.uuid(),
    subject: z.string(),
    fromName: z.string(),
    fromEmail: z.string(),
    sentAt: z.string(),
    /** Zwei Sätze von Reziproq (IN-04); null ohne gültige Zusammenfassung */
    summary: z.string().nullable(),
    assignedBy: z.enum(['reziproq', 'human']),
  }),
  commitments: z.array(mailCommitmentSchema),
  reply: z.object({ to: z.string(), subject: z.string(), text: z.string() }),
  /** Darf anpassen, verwerfen und (mit K2-d.4) freigeben */
  canDecide: z.boolean(),
});
export type MailCommitmentsView = z.infer<typeof mailCommitmentsViewSchema>;

export const mailCommitmentsUpdateSchema = z
  .object({
    commitments: z
      .array(
        z.object({
          index: z.number().int().min(0).max(19),
          title: z.string().trim().min(1).max(200).optional(),
          ownerName: z.string().trim().min(1).max(200).optional(),
          dueOn: isoDay.optional(),
        }),
      )
      .max(20)
      .optional(),
    replyText: z.string().trim().min(1).max(4000).optional(),
  })
  .refine((value) => value.commitments !== undefined || value.replyText !== undefined);
export type MailCommitmentsUpdate = z.input<typeof mailCommitmentsUpdateSchema>;

export const mailReplyVariants = ['kuerzer', 'foermlicher', 'englisch'] as const;
export type MailReplyVariant = (typeof mailReplyVariants)[number];
export const mailReplyVariantSchema = z.object({ variant: z.enum(mailReplyVariants) });

export const mailDiscardSchema = z.object({ reason: z.string().trim().min(1).max(500) });
