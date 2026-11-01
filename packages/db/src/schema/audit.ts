import { sql } from 'drizzle-orm';
import { check, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
export const outboxEvent = pgTable('outbox_event', {
  id: uuid().primaryKey().default(sql`uuidv7()`),
  occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  eventType: text().notNull(),
  objectType: text().notNull(),
  objectId: text().notNull(),
  auditEventId: uuid().notNull(),
  orgId: uuid().notNull(),
  // Leer: noch nicht verarbeitet.
  processedAt: timestamp({ withTimezone: true }),
});
