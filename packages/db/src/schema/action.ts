import { sql } from 'drizzle-orm';
import { check, date, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// QBR-03: Maßnahmen einer Beziehung. Geteilt oder intern (visibility); jede Seite bearbeitet nur
// ihre eigenen Zeilen (PLT-04). Den Status geteilter Maßnahmen ändern beide Seiten über die
// Funktion app_massnahme_status. Personen stehen als ID und Name ohne Fremdschlüssel auf app_user.

export const actionStatuses = ['open', 'in_progress', 'done', 'cancelled'] as const;
export const actionSourceTypes = ['meeting', 'feedback_gap', 'initiative', 'manual'] as const;

export const action = pgTable(
  'action',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] }).notNull().default('shared'),
    title: text().notNull(),
    description: text(),
    ownerSide: text({ enum: ['buyer', 'supplier'] }).notNull(),
    ownerUserId: text(),
    ownerName: text().notNull(),
    dueDate: date().notNull(),
    status: text({ enum: actionStatuses }).notNull().default('open'),
    // Genau eine Quelle: manual ohne ID, alle anderen mit (Prüfung unten).
    sourceType: text({ enum: actionSourceTypes }).notNull(),
    sourceId: uuid(),
    doneAt: timestamp({ withTimezone: true }),
    createdBy: text().notNull(),
    createdByName: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('action_status', sql`${table.status} in ('open', 'in_progress', 'done', 'cancelled')`),
    check('action_owner_side', sql`${table.ownerSide} in ('buyer', 'supplier')`),
    check(
      'action_source_type',
      sql`${table.sourceType} in ('meeting', 'feedback_gap', 'initiative', 'manual')`,
    ),
    check(
      'action_one_source',
      sql`(${table.sourceType} = 'manual') = (${table.sourceId} is null)`,
    ),
    check('action_title', sql`length(trim(${table.title})) between 1 and 200`),
    index('action_relationship').on(table.relationshipId, table.dueDate),
    index('action_owner_user').on(table.ownerUserId),
  ],
);

/** Private Quelle einer Maßnahme, z. B. ein Hinweis (FS-01); nur die eigene Seite sieht sie. */
export const actionPrivateSource = pgTable(
  'action_private_source',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    actionId: uuid()
      .notNull()
      .references(() => action.id, { onDelete: 'cascade' }),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    sourceType: text().notNull(),
    sourceId: uuid().notNull(),
  },
  (table) => [index('action_private_source_action').on(table.actionId)],
);
