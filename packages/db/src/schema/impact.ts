import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { initiative } from './initiative.js';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// PNL-01, PNL-03: GuV-Wirkung einer gemeinsamen Initiative. Hebel, GuV-Zeile, Wirkungsart und
// Baseline sind käuferprivat; der Reifegrad ist geteilt (maturity_step). Kein Fremdschlüssel von
// geteilt auf privat: Die privaten Tabellen zeigen auf die geteilte Initiative.

/** GuV-Zeilen der Organisation (org_private); Standardzeilen entstehen beim ersten Lesen. */
export const pnlLine = pgTable(
  'pnl_line',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    key: text().notNull(),
    name: text().notNull(),
    position: integer().notNull(),
    active: boolean().notNull().default(true),
  },
  (table) => [
    unique('pnl_line_key').on(table.orgId, table.key),
    check('pnl_line_name', sql`length(trim(${table.name})) between 1 and 120`),
    check('pnl_line_key_form', sql`${table.key} ~ '^[a-z][a-z0-9_]{1,40}$'`),
  ],
);

/** Wirkung einer Initiative: Hebel mit Version der Rechenregel, GuV-Zeile, Wirkungsart. */
export const initiativeImpact = pgTable(
  'initiative_impact',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    initiativeId: uuid()
      .notNull()
      .references(() => initiative.id, { onDelete: 'cascade' }),
    lever: text().notNull(),
    leverTemplateVersion: integer().notNull(),
    pnlLineKey: text().notNull(),
    effectType: text().notNull(),
    effectiveFrom: date(),
    createdBy: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'initiative_impact_lever',
      sql`${table.lever} in ('price', 'cost_avoidance', 'quality', 'logistics', 'working_capital', 'innovation', 'risk')`,
    ),
    check(
      'initiative_impact_effect',
      sql`${table.effectType} in ('ebit', 'cost_avoidance', 'cash', 'strategic')`,
    ),
    check('initiative_impact_version', sql`${table.leverTemplateVersion} > 0`),
    index('initiative_impact_initiative').on(table.initiativeId),
  ],
);

/** Eingefrorene Baseline je Version, käuferprivat und nur anfügbar; Änderung = neue Version. */
export const initiativeBaseline = pgTable(
  'initiative_baseline',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    initiativeId: uuid()
      .notNull()
      .references(() => initiative.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
    leverTemplateVersion: integer().notNull(),
    inputs: jsonb().notNull(),
    frozenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    frozenBy: text().notNull(),
    frozenByName: text().notNull(),
    changeReason: text(),
  },
  (table) => [
    check('initiative_baseline_version', sql`${table.version} > 0`),
    check(
      'initiative_baseline_reason',
      sql`${table.version} = 1 or length(trim(coalesce(${table.changeReason}, ''))) > 0`,
    ),
    index('initiative_baseline_initiative').on(table.initiativeId, table.version),
  ],
);

/** Reifegrad R1 bis R5 als Folge von Stufen mit Nachweis, geteilt und nur anfügbar. */
export const maturityStep = pgTable(
  'maturity_step',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] }).notNull().default('shared'),
    initiativeId: uuid()
      .notNull()
      .references(() => initiative.id, { onDelete: 'cascade' }),
    fromLevel: integer().notNull(),
    toLevel: integer().notNull(),
    evidence: text().notNull(),
    evidenceLink: text(),
    decidedBy: text().notNull(),
    decidedByName: text().notNull(),
    decidedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('maturity_step_levels', sql`${table.toLevel} = ${table.fromLevel} + 1`),
    check('maturity_step_range', sql`${table.fromLevel} between 1 and 4`),
    check('maturity_step_evidence', sql`length(trim(${table.evidence})) between 1 and 2000`),
    index('maturity_step_initiative').on(table.initiativeId, table.decidedAt),
  ],
);
