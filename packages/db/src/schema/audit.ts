import { sql } from 'drizzle-orm';
import { check, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// PLT-08: Verlauf und Outbox. Beide entstehen in derselben Transaktion wie die Änderung
// (auditedChange in src/audit.ts). Keine Fremdschlüssel: Der Verlauf überdauert das Objekt.

export const auditActions = ['created', 'updated', 'ended', 'shared', 'approved'] as const;
export type AuditAction = (typeof auditActions)[number];

/** Je Feld der alte und der neue Wert. */
export type AuditChanges = Record<string, { from: unknown; to: unknown }>;

/**
 * Verlauf (shared, nur anfügen): Die Sichtbarkeit folgt dem Objekt. Einträge zu geteilten
 * Objekten sehen beide Seiten, zu internen nur die eigene Organisation (owner_org_id).
 */
export const auditEvent = pgTable(
  'audit_event',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    actorUserId: text().notNull(),
    // Beim Eintrag festgehalten: Fremde Nutzer kann die andere Seite nicht lesen (RLS).
    actorName: text().notNull(),
    ownerOrgId: uuid().notNull(),
    // Die Organisation der handelnden Person ist immer die Eigentümerin des Eintrags.
    actorOrgId: uuid().notNull().generatedAlwaysAs(sql`owner_org_id`),
    visibility: text({ enum: ['internal', 'shared'] }).notNull(),
    relationshipId: uuid(),
    objectType: text().notNull(),
    objectId: text().notNull(),
    action: text({ enum: auditActions }).notNull(),
    changes: jsonb().$type<AuditChanges>().notNull().default({}),
  },
  (table) => [
    check(
      'audit_event_action',
      sql`${table.action} in ('created', 'updated', 'ended', 'shared', 'approved')`,
    ),
  ],
);

/** Outbox (nur Betrieb): Später verschicken E-Mails (QS-01) und Erinnerungen von hier aus. */
export const outboxEvent = pgTable(
  'outbox_event',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    eventType: text().notNull(),
    objectType: text().notNull(),
    objectId: text().notNull(),
    auditEventId: uuid().notNull(),
    orgId: uuid().notNull(),
    // Leer: noch nicht verarbeitet.
    processedAt: timestamp({ withTimezone: true }),
    emailTemplate: text({
      enum: [
        'invitation',
        'reminder',
        'approval',
        'escalation',
        'supplier_invitation',
        'survey',
        'mention',
        'export_ready',
      ],
    }),
    emailLocale: text({ enum: ['de', 'en'] }),
    emailRecipient: text(),
    emailFirstName: text(),
    emailTitle: text(),
    emailDeadline: text(),
    emailLink: text(),
    // Nur bei supplier_invitation (LIF-01): wer einlädt und eine kurze persönliche Nachricht.
    emailSender: text(),
    emailMessage: text(),
  },
  (table) => [
    check(
      'outbox_event_email_payload',
      sql`(
        (${table.emailTemplate} IS NULL AND ${table.emailLocale} IS NULL
          AND ${table.emailRecipient} IS NULL AND ${table.emailFirstName} IS NULL
          AND ${table.emailTitle} IS NULL AND ${table.emailDeadline} IS NULL
          AND ${table.emailLink} IS NULL AND ${table.emailSender} IS NULL
          AND ${table.emailMessage} IS NULL)
        OR
        (${table.emailTemplate} IS NOT NULL
          AND ${table.emailTemplate} IN (
            'invitation', 'reminder', 'approval', 'escalation', 'supplier_invitation', 'survey',
            'mention', 'export_ready'
          )
          AND ${table.emailLocale} IS NOT NULL
          AND ${table.emailLocale} IN ('de', 'en')
          AND ${table.emailRecipient} IS NOT NULL
          AND length(trim(${table.emailRecipient})) > 0
          AND ${table.emailTitle} IS NOT NULL
          AND length(trim(${table.emailTitle})) > 0
          AND ${table.emailLink} IS NOT NULL
          AND ${table.emailLink} LIKE '/%'
          AND ${table.emailLink} NOT LIKE '//%'
          AND position('?' in ${table.emailLink}) = 0
          AND position('#' in ${table.emailLink}) = 0
          AND position(chr(92) in ${table.emailLink}) = 0)
      )`,
    ),
  ],
);

export const emailLog = pgTable(
  'email_log',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    outboxEventId: uuid().notNull().unique(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp({ withTimezone: true }),
    template: text({
      enum: [
        'invitation',
        'reminder',
        'approval',
        'escalation',
        'supplier_invitation',
        'survey',
        'mention',
        'export_ready',
      ],
    }).notNull(),
    status: text({ enum: ['sending', 'sent', 'failed'] }).notNull(),
    recipientHash: text().notNull(),
    attemptCount: integer().notNull().default(1),
    nextAttemptAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    check('email_log_status', sql`${table.status} in ('sending', 'sent', 'failed')`),
    check('email_log_attempt_count', sql`${table.attemptCount} > 0`),
  ],
);
