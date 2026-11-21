import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { appUser } from './app-user.js';
import { materialGroup } from './master-data.js';
import { organization } from './organization.js';

// WG-04, WG-06: Strategie je Warengruppe und Jahr in zehn Schritten, mit Leitfragen, „Beobachtung
// und Erklärung“ je Schritt und Sicht, Meilensteinen, Kennzahlen und Zielen. Alles org_private:
// nur die eigene Organisation, der Lieferant nie. In den Specs heißen die Tabellen category_*.

export const strategyStatuses = ['draft', 'resubmit', 'approved'] as const;

export const materialGroupStrategy = pgTable(
  'material_group_strategy',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    materialGroupId: uuid()
      .notNull()
      .references(() => materialGroup.id),
    year: integer().notNull(),
    status: text({ enum: strategyStatuses }).notNull().default('draft'),
    version: integer().notNull().default(1),
    lastSubmittedAt: timestamp({ withTimezone: true }),
    changedSinceSubmission: boolean().notNull().default(false),
    approvedAt: timestamp({ withTimezone: true }),
    createdBy: text()
      .notNull()
      .references(() => appUser.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('material_group_strategy_status', sql`${table.status} in ('draft', 'resubmit', 'approved')`),
    check('material_group_strategy_year', sql`${table.year} between 2000 and 2100`),
    unique('material_group_strategy_once').on(table.materialGroupId, table.year, table.version),
    index('material_group_strategy_org').on(table.orgId, table.year),
  ],
);

/** Leitfragen je Schritt und Sicht; Startbestand aus WG-startdaten.md, je Kunde änderbar */
export const materialGroupQuestion = pgTable(
  'material_group_question',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    step: integer().notNull(),
    view: text(),
    text: text().notNull(),
    position: integer().notNull(),
  },
  (table) => [
    check('material_group_question_step', sql`${table.step} between 1 and 10`),
    index('material_group_question_org').on(table.orgId, table.step),
  ],
);

/** „Beobachtung und Erklärung“ je Schritt und Sicht; nicht zutreffend nur mit Begründung */
export const materialGroupNote = pgTable(
  'material_group_note',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    step: integer().notNull(),
    view: text().notNull().default(''),
    text: text().notNull().default(''),
    notApplicable: boolean().notNull().default(false),
    updatedBy: text().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('material_group_note_step', sql`${table.step} between 1 and 10`),
    check(
      'material_group_note_reason',
      sql`not ${table.notApplicable} or length(trim(${table.text})) > 0`,
    ),
    uniqueIndex('material_group_note_once').on(table.strategyId, table.step, table.view),
  ],
);

/** Nächste Meilensteine aus dem Aufsetzen (WG-04 Schritt 1) */
export const materialGroupMilestone = pgTable(
  'material_group_milestone',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    dueOn: date().notNull(),
  },
  (table) => [index('material_group_milestone_strategy').on(table.strategyId)],
);

/** WG-06: feste Kennzahlen je Dimension (Zielkategorie); Startbestand zwei je Dimension */
export const materialGroupKpi = pgTable(
  'material_group_kpi',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    dimension: text().notNull(),
    name: text().notNull(),
    description: text(),
    unit: text(),
    source: text(),
    active: boolean().notNull().default(true),
  },
  (table) => [
    uniqueIndex('material_group_kpi_name').on(table.orgId, table.dimension, sql`lower(${table.name})`),
  ],
);

/** WG-06: Ziel der Strategie an genau einer Kennzahl; zurückgestellt nur mit Begründung */
export const materialGroupGoal = pgTable(
  'material_group_goal',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    strategyId: uuid()
      .notNull()
      .references(() => materialGroupStrategy.id, { onDelete: 'cascade' }),
    kpiId: uuid()
      .notNull()
      .references(() => materialGroupKpi.id),
    text: text().notNull().default(''),
    actual: numeric({ precision: 14, scale: 4 }),
    targetNextYear: numeric({ precision: 14, scale: 4 }),
    targetFinal: numeric({ precision: 14, scale: 4 }),
    targetQuarter: integer(),
    targetYear: integer(),
    deferred: boolean().notNull().default(false),
    deferredReason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'material_group_goal_deferred',
      sql`not ${table.deferred} or length(trim(coalesce(${table.deferredReason}, ''))) > 0`,
    ),
    check(
      'material_group_goal_text',
      sql`${table.deferred} or length(trim(${table.text})) > 0`,
    ),
    check(
      'material_group_goal_quarter',
      sql`${table.targetQuarter} is null or ${table.targetQuarter} between 1 and 4`,
    ),
    index('material_group_goal_strategy').on(table.strategyId),
  ],
);
