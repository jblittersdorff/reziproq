import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
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
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('shared'),
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

/** PNL-05: Eingaben je Monat nach der Vorlage des Hebels, Plan oder Ist; käuferprivat. */
export const initiativeInputMonth = pgTable(
  'initiative_input_month',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    initiativeId: uuid()
      .notNull()
      .references(() => initiative.id, { onDelete: 'cascade' }),
    month: date().notNull(),
    kind: text({ enum: ['plan', 'actual'] }).notNull(),
    inputs: jsonb().notNull(),
    source: text({ enum: ['manual', 'csv'] }).notNull(),
    enteredBy: text().notNull(),
    enteredByName: text().notNull(),
    enteredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('initiative_input_month_kind', sql`${table.kind} in ('plan', 'actual')`),
    check('initiative_input_month_source', sql`${table.source} in ('manual', 'csv')`),
    check('initiative_input_month_first', sql`extract(day from ${table.month}) = 1`),
    index('initiative_input_month_initiative').on(table.initiativeId, table.month),
  ],
);

/**
 * PNL-05: Berechneter Betrag je Monat und Art, nur durch app_initiative_recompute geschrieben.
 * Geteilte Ebene; bis die Teilungsregel (PNL-07) greift, sind die Zeilen intern (visibility).
 */
export const initiativeValue = pgTable(
  'initiative_value',
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
      .default('internal'),
    initiativeId: uuid()
      .notNull()
      .references(() => initiative.id, { onDelete: 'cascade' }),
    month: date().notNull(),
    kind: text({ enum: ['plan', 'actual'] }).notNull(),
    // Nicht amount_cents: Der Name gehört dem käuferprivaten Spend; so bleibt die Prüfung auf
    // private Felder im geteilten Verlauf (PLT-08) eindeutig.
    valueCents: bigint({ mode: 'number' }).notNull(),
    currency: text().notNull().default('EUR'),
    effectType: text().notNull(),
    computedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('initiative_value_kind', sql`${table.kind} in ('plan', 'actual')`),
    index('initiative_value_initiative').on(table.initiativeId, table.month),
  ],
);

export const validationStatuses = ['requested', 'approved', 'rejected'] as const;

/** PNL-06: Freigabe einer Wirkung durch Controlling für einen Zeitraum; käuferprivat. */
export const initiativeValidation = pgTable(
  'initiative_validation',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    initiativeId: uuid()
      .notNull()
      .references(() => initiative.id, { onDelete: 'cascade' }),
    periodFrom: date().notNull(),
    periodTo: date().notNull(),
    status: text({ enum: validationStatuses }).notNull().default('requested'),
    requestedBy: text().notNull(),
    requestedByName: text().notNull(),
    requestedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    decidedBy: text(),
    decidedByName: text(),
    decidedAt: timestamp({ withTimezone: true }),
    comment: text(),
  },
  (table) => [
    check(
      'initiative_validation_status',
      sql`${table.status} in ('requested', 'approved', 'rejected')`,
    ),
    check('initiative_validation_period', sql`${table.periodTo} >= ${table.periodFrom}`),
    check(
      'initiative_validation_comment',
      sql`${table.status} <> 'rejected' or length(trim(coalesce(${table.comment}, ''))) > 0`,
    ),
    index('initiative_validation_initiative').on(table.initiativeId, table.status),
  ],
);

/**
 * PNL-07: Teilungsregel je Initiative, geteilt und immer sichtbar für beide Seiten. Der Käufer
 * schlägt vor (damit bestätigt er), der Lieferant bestätigt über app_initiative_share_confirm.
 * Jede Änderung durch den Käufer setzt die Bestätigung zurück. Erst vereinbart (agreed_at) wird
 * die berechnete Wirkung (initiative_value) für beide Seiten sichtbar.
 */
export const initiativeShare = pgTable(
  'initiative_share',
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
    initiativeId: uuid()
      .notNull()
      .references(() => initiative.id, { onDelete: 'cascade' }),
    buyerSharePct: smallint().notNull(),
    supplierSharePct: smallint().notNull(),
    ruleText: text(),
    proposedBy: text().notNull(),
    proposedByName: text().notNull(),
    proposedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    supplierConfirmedByName: text(),
    agreedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    // Je Initiative eine Regel; der Dienst ändert die vorhandene statt eine zweite anzulegen.
    index('initiative_share_initiative').on(table.initiativeId),
    check(
      'initiative_share_summe',
      sql`${table.buyerSharePct} between 0 and 100 and ${table.supplierSharePct} between 0 and 100 and ${table.buyerSharePct} + ${table.supplierSharePct} = 100`,
    ),
    check(
      'initiative_share_vereinbart',
      sql`(${table.agreedAt} is null) = (${table.supplierConfirmedByName} is null)`,
    ),
  ],
);

/** PNL-07: Eigener Nutzen des Lieferanten je Monat; nur der Lieferant sieht ihn. */
export const supplierBenefit = pgTable(
  'supplier_benefit',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    initiativeId: uuid()
      .notNull()
      .references(() => initiative.id, { onDelete: 'cascade' }),
    month: date().notNull(),
    amountCents: bigint({ mode: 'number' }).notNull(),
    currency: text().notNull().default('EUR'),
    note: text(),
    createdBy: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('supplier_benefit_je_monat').on(table.initiativeId, table.month),
    check('supplier_benefit_monat', sql`extract(day from ${table.month}) = 1`),
    check('supplier_benefit_waehrung', sql`${table.currency} ~ '^[A-Z]{3}$'`),
  ],
);

/**
 * PNL-07: Verweis auf das Savings-Tracking des Käufers (z. B. Coupa, Sievo). Initiativen mit
 * Verweis sind markiert und zählen in keiner Summe (keine Doppelzählung). Käuferprivat.
 */
export const savingsReference = pgTable(
  'savings_reference',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    initiativeId: uuid()
      .notNull()
      .references(() => initiative.id, { onDelete: 'cascade' }),
    system: text().notNull(),
    reference: text().notNull(),
    createdBy: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('savings_reference_je_initiative').on(table.initiativeId),
    check(
      'savings_reference_texte',
      sql`length(trim(${table.system})) between 1 and 80 and length(trim(${table.reference})) between 1 and 200`,
    ),
  ],
);
