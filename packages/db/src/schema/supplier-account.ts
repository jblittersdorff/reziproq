import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { relationship } from './relationship.js';

// LIF-03: Eigene Sicht des Lieferanten auf einen Kunden. Lieferantenprivat: Der Käufer sieht weder
// Zeilen noch Anzahlen. Eine Zeile je Beziehung für den Plan (der Dienst liest die jüngste).

export const supplierAccountPlan = pgTable(
  'supplier_account_plan',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    summary: text(),
    ownViewOfCustomer: text(),
    /** 1 bis 5, wie wichtig der Kunde für den Lieferanten ist */
    customerImportance: smallint(),
    updatedBy: text().notNull(),
    updatedByName: text().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'supplier_account_plan_importance',
      sql`${table.customerImportance} is null or ${table.customerImportance} between 1 and 5`,
    ),
    check(
      'supplier_account_plan_summary',
      sql`${table.summary} is null or length(${table.summary}) <= 4000`,
    ),
    check(
      'supplier_account_plan_view',
      sql`${table.ownViewOfCustomer} is null or length(${table.ownViewOfCustomer}) <= 4000`,
    ),
    index('supplier_account_plan_relationship').on(table.relationshipId, table.updatedAt),
  ],
);

export const supplierAccountObjective = pgTable(
  'supplier_account_objective',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    text: text().notNull(),
    ownerUserId: text(),
    ownerName: text(),
    targetYear: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('supplier_account_objective_text', sql`length(trim(${table.text})) between 1 and 500`),
    check('supplier_account_objective_year', sql`${table.targetYear} between 2000 and 2100`),
    index('supplier_account_objective_relationship').on(table.relationshipId),
  ],
);
