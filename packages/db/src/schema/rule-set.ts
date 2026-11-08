import { sql } from 'drizzle-orm';
import {
  check,
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
import { organization } from './organization.js';
import type { CatalogText } from './playbook.js';
import { relationship } from './relationship.js';

/**
 * Spielregeln einer Beziehung (PLB-03), shared mit visibility internal, bis SEG-10 sie teilt.
 * Jede Version ist eine eigene Zeile; freigegebene Versionen ändert niemand mehr. Statt einer ID
 * des Segmenttyps stehen die Stufen und der Name des Soll-Typs zur Zeit des Vorschlags hier.
 */
export const ruleSet = pgTable(
  'rule_set',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] }).notNull().default('internal'),
    version: integer().notNull(),
    status: text({ enum: ['draft', 'approved', 'shared'] }).notNull().default('draft'),
    targetImpactLevel: smallint().notNull(),
    targetQualityLevel: smallint().notNull(),
    typeName: text().notNull(),
    // Wie im Verlauf: ID und Name ohne Fremdschlüssel, denn app_user ist für die andere Seite privat.
    createdBy: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    approvedBy: text(),
    approvedByName: text(),
    approvedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    unique('rule_set_version').on(table.relationshipId, table.version),
    check('rule_set_status', sql`${table.status} in ('draft', 'approved', 'shared')`),
    check(
      'rule_set_levels',
      sql`${table.targetImpactLevel} between 1 and 3 and ${table.targetQualityLevel} between 1 and 3`,
    ),
    check(
      'rule_set_approved',
      sql`(${table.status} = 'draft') = (${table.approvedAt} IS NULL AND ${table.approvedBy} IS NULL AND ${table.approvedByName} IS NULL)`,
    ),
  ],
);

/**
 * Ein Eintrag einer Version: Recht, Pflicht oder Format, als Kopie des Katalogeintrags (origin
 * catalog, dessen ID ohne Fremdschlüssel, weil der Katalog privat ist) oder eigener Eintrag.
 */
export const ruleSetItem = pgTable(
  'rule_set_item',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    ruleSetId: uuid()
      .notNull()
      .references(() => ruleSet.id, { onDelete: 'cascade' }),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] }).notNull().default('internal'),
    kind: text({ enum: ['right', 'obligation', 'format'] }).notNull(),
    group: text({ enum: ['cost', 'protection', 'collaboration', 'growth'] }),
    title: jsonb().$type<CatalogText>().notNull(),
    description: jsonb().$type<CatalogText>().notNull(),
    cadence: text({ enum: ['monthly', 'quarterly', 'semiannual', 'annual', 'on_demand'] }),
    level: text({ enum: ['executive', 'management', 'operational'] }),
    origin: text({ enum: ['catalog', 'custom'] }).notNull(),
    catalogItemId: uuid(),
    position: integer().notNull(),
  },
  (table) => [
    check('rule_set_item_kind', sql`${table.kind} in ('right', 'obligation', 'format')`),
    check('rule_set_item_origin', sql`${table.origin} in ('catalog', 'custom')`),
    check(
      'rule_set_item_catalog',
      sql`(${table.origin} = 'catalog') = (${table.catalogItemId} IS NOT NULL)`,
    ),
    check(
      'rule_set_item_shape',
      sql`(${table.kind} = 'format') = (${table.group} IS NULL AND ${table.cadence} IS NOT NULL)`,
    ),
    index('rule_set_item_set').on(table.ruleSetId),
  ],
);

/**
 * Interne Begründung einer Abweichung vom Katalog (PLB-03), buyer_private: zu einem eigenen
 * Eintrag (rule_set_item_id) oder zu einem abgewählten Katalogeintrag (catalog_item_id, mit Kopie
 * des Eintrags, damit die Seite ihn auch später zeigen kann).
 */
export const ruleSetNote = pgTable(
  'rule_set_note',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ruleSetId: uuid()
      .notNull()
      .references(() => ruleSet.id, { onDelete: 'cascade' }),
    ruleSetItemId: uuid().references(() => ruleSetItem.id, { onDelete: 'cascade' }),
    catalogItemId: uuid(),
    removedItem: jsonb().$type<Record<string, unknown>>(),
    deviationReason: text().notNull(),
  },
  (table) => [
    check(
      'rule_set_note_target',
      sql`(${table.ruleSetItemId} IS NULL) <> (${table.catalogItemId} IS NULL)`,
    ),
    check('rule_set_note_reason', sql`length(trim(${table.deviationReason})) between 3 and 1000`),
    index('rule_set_note_set').on(table.ruleSetId),
  ],
);

/**
 * Mit dem Lieferanten geteilter Beziehungstyp (SEG-10), shared und geteilt. Name und Beschreibung
 * sind der Stand beim Teilen; eine spätere Umbenennung im Modell ändert sie nicht. Eine Zeile je
 * Beziehung, beim nächsten Teilen überschrieben.
 */
export const relationshipTarget = pgTable(
  'relationship_target',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] }).notNull().default('shared'),
    typeName: text().notNull(),
    typeDescription: text().notNull(),
    ruleSetId: uuid()
      .notNull()
      .references(() => ruleSet.id),
    ruleSetVersion: integer().notNull(),
    sharedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    // Wie im Verlauf: ID und Name ohne Fremdschlüssel auf app_user.
    sharedBy: text().notNull(),
    sharedByName: text().notNull(),
  },
  (table) => [
    unique('relationship_target_relationship').on(
      table.relationshipId,
      table.ownerOrgId,
      table.visibility,
    ),
  ],
);
