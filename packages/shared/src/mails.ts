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
