import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { appUser } from './app-user.js';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// IN-04: Abgelegte Mails mit Lieferanten, nur beim Käufer (org_private). „Nur ich“ (private) sieht
// nur, wer sie abgelegt hat (Policy filed_mail_private_owner). Gespeichert wird nur der Text ohne
// HTML, Bilder und Links; Anhänge liegen in der Dateiablage (file_key), mit KI-18 als Dokumente.

export const filedMailVisibilities = ['team', 'private'] as const;
export const filedMailSources = ['addin', 'forward'] as const;
export const filedMailAssigners = ['reziproq', 'human'] as const;

export const filedMail = pgTable(
  'filed_mail',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id, { onDelete: 'cascade' }),
    filedBy: text()
      .notNull()
      .references(() => appUser.id),
    visibility: text({ enum: filedMailVisibilities }).notNull(),
    // Message-ID der Mail (Internet-Kopfzeile); nichts wird doppelt abgelegt
    messageId: text().notNull(),
    fromEmail: text().notNull(),
    fromName: text(),
    toEmails: jsonb().$type<string[]>().notNull().default([]),
    sentAt: timestamp({ withTimezone: true }).notNull(),
    subject: text().notNull(),
    bodyText: text().notNull(),
    // Zwei Sätze der KI als Entwurf (ai_draft, Art mail_summary); leer, wenn verworfen
    summaryDraftId: uuid(),
    source: text({ enum: filedMailSources }).notNull(),
    // PO-01 (K2-d): wer zugeordnet hat; Reziproq ab Konfidenz 0,9 selbst (E-K2-5), sonst ein Mensch
    assignedBy: text({ enum: filedMailAssigners }).notNull().default('human'),
    assignConfidence: numeric({ precision: 3, scale: 2, mode: 'number' }),
    // Erkannte Zusagen, Termine und Änderungen mit Textstelle; leer, solange nichts erkannt ist
    extracted: jsonb(),
    // Antwortentwurf im Ton der Organisation (ai_draft)
    replyDraftId: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    check('filed_mail_visibility', sql`${table.visibility} in ('team', 'private')`),
    check('filed_mail_source', sql`${table.source} in ('addin', 'forward')`),
    check('filed_mail_assigned_by', sql`${table.assignedBy} in ('reziproq', 'human')`),
    check(
      'filed_mail_confidence',
      sql`${table.assignConfidence} is null or ${table.assignConfidence} between 0 and 1`,
    ),
    unique('filed_mail_eindeutig').on(table.orgId, table.relationshipId, table.messageId),
    index('filed_mail_relationship').on(table.relationshipId, table.sentAt),
  ],
);

export const filedMailAttachment = pgTable(
  'filed_mail_attachment',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id, { onDelete: 'cascade' }),
    filedMailId: uuid()
      .notNull()
      .references(() => filedMail.id, { onDelete: 'cascade' }),
    // Wie die Mail: „Nur ich“ gilt auch für ihre Anhänge (Policy filed_mail_attachment_private_owner)
    filedBy: text()
      .notNull()
      .references(() => appUser.id),
    visibility: text({ enum: filedMailVisibilities }).notNull(),
    fileName: text().notNull(),
    mime: text().notNull(),
    size: bigint({ mode: 'number' }).notNull(),
    // Schlüssel in der Dateiablage; leer, wenn der Anhang zu groß war (über 25 MB)
    fileKey: text(),
    // KI-18: Dokument des Lieferanten, sobald es Dokumente gibt
    documentId: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    check('filed_mail_attachment_visibility', sql`${table.visibility} in ('team', 'private')`),
    index('filed_mail_attachment_mail').on(table.filedMailId),
  ],
);
