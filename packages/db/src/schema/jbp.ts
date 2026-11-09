import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { meeting } from './meeting.js';
import { organization } from './organization.js';
import { cycle, relationship } from './relationship.js';

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
    visibility: text({ enum: ['internal', 'shared'] }).notNull().default('shared'),
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
  (table) => [unique('jbp_cycle_link_once').on(table.jbpId)],
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
    visibility: text({ enum: ['internal', 'shared'] }).notNull().default('shared'),
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
