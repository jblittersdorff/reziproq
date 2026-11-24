import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { confirmColumns, confirmConstraint, originColumns, originConstraint } from './columns.js';
import { meeting } from './meeting.js';
import { organization } from './organization.js';
import { cycle, relationship } from './relationship.js';
import { strategicTopic } from './supplier-plan.js';

// JBP-01: Gemeinsamer Plan einer Beziehung (Joint Business Planning). Geteilt; der Verweis auf
// den Zyklus ist käuferprivat, weil der Zyklus es ist. Geschäftsupdates schreibt jede Seite selbst.

export const jbpStatuses = ['draft', 'in_review', 'approved'] as const;

export const jbp = pgTable(
  'jbp',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('shared'),
    // Termin der Art jbp (QBR-01); geteilt auf geteilt.
    meetingId: uuid().references(() => meeting.id, { onDelete: 'set null' }),
    version: integer().notNull().default(1),
    status: text({ enum: jbpStatuses }).notNull().default('draft'),
    createdBy: text().notNull(),
    createdByName: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('jbp_status', sql`${table.status} in ('draft', 'in_review', 'approved')`),
    check('jbp_version', sql`${table.version} > 0`),
    index('jbp_relationship').on(table.relationshipId, table.version),
  ],
);

/** Käuferprivater Verweis vom Gemeinsamen Plan auf den Jahreszyklus (ZYK-01). */
export const jbpCycleLink = pgTable(
  'jbp_cycle_link',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    jbpId: uuid()
      .notNull()
      .references(() => jbp.id, { onDelete: 'cascade' }),
    cycleId: uuid()
      .notNull()
      .references(() => cycle.id),
  },
  // ZYK-05: Ein Plan läuft als neue Version im nächsten Zyklus weiter; je Zyklus ein Verweis.
  (table) => [unique('jbp_cycle_link_once').on(table.jbpId, table.cycleId)],
);

/** Geschäftsupdate einer Seite für das JBP; je Seite eines (über owner_org_id). */
export const jbpBusinessUpdate = pgTable(
  'jbp_business_update',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('shared'),
    jbpId: uuid()
      .notNull()
      .references(() => jbp.id, { onDelete: 'cascade' }),
    side: text({ enum: ['buyer', 'supplier'] }).notNull(),
    text: text().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('jbp_business_update_side', sql`${table.side} in ('buyer', 'supplier')`),
    check('jbp_business_update_text', sql`length(${table.text}) <= 10000`),
    unique('jbp_business_update_per_side').on(table.jbpId, table.ownerOrgId, table.visibility),
  ],
);

export const jbpTopicStatuses = ['proposed', 'merged', 'parked'] as const;

/**
 * JBP-02: Thema einer Seite im Gemeinsamen Plan, geteilt. Nur Titel und eine teilbare
 * Beschreibung; Begründung und Ziele bleiben im Lieferantenplan.
 */
export const jbpTopic = pgTable(
  'jbp_topic',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('shared'),
    jbpId: uuid()
      .notNull()
      .references(() => jbp.id, { onDelete: 'cascade' }),
    side: text({ enum: ['buyer', 'supplier'] }).notNull(),
    title: text().notNull(),
    description: text().notNull().default(''),
    priority: integer().notNull(),
    status: text({ enum: jbpTopicStatuses }).notNull().default('proposed'),
    parkReason: text(),
    createdBy: text().notNull(),
    createdByName: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    // ZA-01: Herkunft und Bestätigung
    ...originColumns(),
    ...confirmColumns(),
  },
  (table) => [
    originConstraint('jbp_topic', table.origin),
    confirmConstraint('jbp_topic', table.confirmState),
    check('jbp_topic_side', sql`${table.side} in ('buyer', 'supplier')`),
    check('jbp_topic_status', sql`${table.status} in ('proposed', 'merged', 'parked')`),
    check('jbp_topic_title', sql`length(trim(${table.title})) between 1 and 200`),
    check('jbp_topic_description', sql`length(${table.description}) <= 2000`),
    check('jbp_topic_priority', sql`${table.priority} > 0`),
    check(
      'jbp_topic_park_reason',
      sql`${table.status} <> 'parked' or length(trim(coalesce(${table.parkReason}, ''))) > 0`,
    ),
    index('jbp_topic_jbp').on(table.jbpId, table.side, table.priority),
  ],
);

/** Herkunft eines Themas aus dem Lieferantenplan (SPL-06), nur beim Käufer. */
export const jbpTopicOrigin = pgTable(
  'jbp_topic_origin',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    jbpTopicId: uuid()
      .notNull()
      .references(() => jbpTopic.id, { onDelete: 'cascade' }),
    strategicTopicId: uuid()
      .notNull()
      .references(() => strategicTopic.id, { onDelete: 'cascade' }),
  },
  (table) => [unique('jbp_topic_origin_once').on(table.jbpTopicId)],
);

/**
 * JBP-06: Entscheidung einer Seite über eine Version des Gemeinsamen Plans, geteilt und nur
 * anfügbar. Zurückgeben verlangt eine Begründung.
 */
export const jbpApproval = pgTable(
  'jbp_approval',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('shared'),
    jbpId: uuid()
      .notNull()
      .references(() => jbp.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
    side: text({ enum: ['buyer', 'supplier'] }).notNull(),
    userId: text().notNull(),
    userName: text().notNull(),
    decision: text({ enum: ['approved', 'returned'] }).notNull(),
    comment: text(),
    decidedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('jbp_approval_side', sql`${table.side} in ('buyer', 'supplier')`),
    check('jbp_approval_decision', sql`${table.decision} in ('approved', 'returned')`),
    check(
      'jbp_approval_comment',
      sql`${table.decision} <> 'returned' or length(trim(coalesce(${table.comment}, ''))) > 0`,
    ),
    index('jbp_approval_jbp').on(table.jbpId, table.version, table.decidedAt),
  ],
);

/** JBP-06: Eingefrorener Inhalt einer freigegebenen Version (Themen, Initiativen, Zusagen). */
export const jbpVersion = pgTable(
  'jbp_version',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('shared'),
    jbpId: uuid()
      .notNull()
      .references(() => jbp.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
    content: jsonb().notNull(),
    approvedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    // ZA-01: Herkunft und Bestätigung
    ...originColumns(),
    ...confirmColumns(),
  },
  (table) => [
    originConstraint('jbp_version', table.origin),
    confirmConstraint('jbp_version', table.confirmState),
    index('jbp_version_jbp').on(table.jbpId, table.version),
  ],
);
