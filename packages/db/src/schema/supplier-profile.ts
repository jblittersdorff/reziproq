import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { relationship } from './relationship.js';

// SPL-05: Profil und Finanzen eines Lieferanten, nur für den Käufer (buyer_private). Nur öffentlich
// verfügbare oder vom Lieferanten gelieferte Zahlen; Personen nur mit Name und Rolle.

export const supplierProfile = pgTable(
  'supplier_profile',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    headquarters: text(),
    foundedYear: smallint(),
    employees: integer(),
    businessSegments: text(),
    // „Was heißt das für uns?“
    implications: text(),
    updatedBy: text().notNull(),
    updatedByName: text().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'supplier_profile_werte',
      sql`(${table.foundedYear} is null or ${table.foundedYear} between 1600 and 2100) and (${table.employees} is null or ${table.employees} >= 0)`,
    ),
    index('supplier_profile_relationship').on(table.relationshipId),
  ],
);

export const supplierExecutive = pgTable(
  'supplier_executive',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    name: text().notNull(),
    role: text().notNull(),
    // Seit welchem Jahr in dieser Rolle; optional.
    since: smallint(),
    position: integer().notNull(),
  },
  (table) => [
    check('supplier_executive_name', sql`length(trim(${table.name})) between 1 and 120`),
    check('supplier_executive_role', sql`length(trim(${table.role})) between 1 and 120`),
    index('supplier_executive_relationship').on(table.relationshipId),
  ],
);

/** Kennzahlen: Beträge in Cent mit Währung, Quoten in Basispunkten; immer mit Quelle. */
export const supplierFinancialMetrics = [
  'revenue',
  'ebit_margin',
  'net_debt',
  'equity_ratio',
  'cash',
] as const;

export const supplierFinancial = pgTable(
  'supplier_financial',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    year: smallint().notNull(),
    metric: text({ enum: supplierFinancialMetrics }).notNull(),
    // Cent bei Beträgen, Basispunkte bei Quoten (unit).
    value: bigint({ mode: 'number' }).notNull(),
    unit: text({ enum: ['cents', 'basis_points'] }).notNull(),
    currency: text(),
    source: text().notNull(),
    updatedBy: text().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('supplier_financial_je_jahr').on(table.relationshipId, table.year, table.metric),
    check(
      'supplier_financial_metric',
      sql`${table.metric} in ('revenue', 'ebit_margin', 'net_debt', 'equity_ratio', 'cash')`,
    ),
    check(
      'supplier_financial_unit',
      sql`case when ${table.metric} in ('ebit_margin', 'equity_ratio')
        then ${table.unit} = 'basis_points' and ${table.currency} is null
        else ${table.unit} = 'cents' and ${table.currency} ~ '^[A-Z]{3}$' end`,
    ),
    check('supplier_financial_source', sql`length(trim(${table.source})) between 1 and 500`),
    check('supplier_financial_year', sql`${table.year} between 1990 and 2100`),
  ],
);
