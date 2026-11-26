import { sql } from 'drizzle-orm';
import { check, date, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { originColumns, originConstraint } from './columns.js';
import { commitment } from './initiative.js';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// ZQ-01 (K2-a): Aufgabe einer Seite zu einer Beziehung, früher interne Maßnahme (E-K2-1). Nur die
// eigene Organisation sieht sie (org_private). Der Raum steht als Spalte (ZA-01) und folgt aus der
// Seite der Organisation in der Beziehung: Der Trigger app_task_space setzt ihn beim Schreiben.
// Personen stehen als ID und Name ohne Fremdschlüssel auf app_user, wie bei den Maßnahmen.

export const taskStatuses = ['open', 'in_progress', 'done', 'cancelled'] as const;
/** Anlass einer Aufgabe; manual ohne ID, alle anderen mit (Prüfung unten) */
export const taskSourceTypes = ['meeting', 'feedback_gap', 'initiative', 'hint', 'manual'] as const;
export const taskSpaces = ['buyer_private', 'supplier_private'] as const;

export const task = pgTable(
  'task',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    /** Organisation, der die Aufgabe gehört */
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    space: text({ enum: taskSpaces }).notNull().default('buyer_private'),
    title: text().notNull(),
    description: text(),
    ownerUserId: text(),
    ownerName: text().notNull(),
    dueDate: date().notNull(),
    status: text({ enum: taskStatuses }).notNull().default('open'),
    sourceType: text({ enum: taskSourceTypes }).notNull().default('manual'),
    sourceId: uuid(),
    doneAt: timestamp({ withTimezone: true }),
    createdBy: text().notNull(),
    createdByName: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
    updatedAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
    // ZA-01: Herkunft
    ...originColumns(),
  },
  (table) => [
    originConstraint('task', table.origin),
    check('task_status', sql`${table.status} in ('open', 'in_progress', 'done', 'cancelled')`),
    check('task_space', sql`${table.space} in ('buyer_private', 'supplier_private')`),
    check(
      'task_source_type',
      sql`${table.sourceType} in ('meeting', 'feedback_gap', 'initiative', 'hint', 'manual')`,
    ),
    check('task_one_source', sql`(${table.sourceType} = 'manual') = (${table.sourceId} is null)`),
    check('task_title', sql`length(trim(${table.title})) between 1 and 200`),
    check('task_owner', sql`length(trim(${table.ownerName})) between 1 and 200`),
    index('task_relationship').on(table.relationshipId, table.dueDate),
    index('task_owner_user').on(table.ownerUserId),
  ],
);

/**
 * ZQ-01 (K2-a.3): Private Quelle einer geteilten Zusage, z. B. ein Hinweis (FS-01); nur die eigene
 * Seite sieht sie. Früher action_private_source; Aufgaben tragen ihre Quelle selbst.
 */
export const commitmentPrivateSource = pgTable(
  'commitment_private_source',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    commitmentId: uuid()
      .notNull()
      .references(() => commitment.id, { onDelete: 'cascade' }),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    sourceType: text().notNull(),
    sourceId: uuid().notNull(),
  },
  (table) => [index('commitment_private_source_commitment').on(table.commitmentId)],
);

/** QBR-04, ZQ-01 (K2-a.3): Was jede Seite zu einer Frist schon verschickt hat, je Zusage oder Aufgabe */
export const reminderKinds = ['reminder', 'escalation'] as const;
export const reminderObjectTypes = ['commitment', 'task'] as const;

export const reminderSent = pgTable(
  'reminder_sent',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    objectType: text({ enum: reminderObjectTypes }).notNull(),
    objectId: uuid().notNull(),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    kind: text({ enum: reminderKinds }).notNull(),
    dueDate: date().notNull(),
    sentAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    check('reminder_sent_kind', sql`${table.kind} in ('reminder', 'escalation')`),
    check('reminder_sent_object_type', sql`${table.objectType} in ('commitment', 'task')`),
    unique('reminder_sent_einmal').on(
      table.orgId,
      table.objectType,
      table.objectId,
      table.kind,
      table.dueDate,
    ),
  ],
);
