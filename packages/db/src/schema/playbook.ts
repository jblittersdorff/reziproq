import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organization } from './organization.js';

/** Text auf Deutsch und Englisch (PLB-01). */
export type CatalogText = { de: string; en: string };

const bilingual = (column: string) =>
  sql`jsonb_typeof(${sql.raw(column)}->'de') = 'string' AND jsonb_typeof(${sql.raw(column)}->'en') = 'string'`;

/**
 * Rechte und Pflichten je Käuferorganisation (PLB-01), org_private. Ein Eintrag gilt für alle
 * Typen ab min_impact_level. counterpart_id verbindet ein Recht mit seiner Gegenpflicht; der Dienst
 * hält die Verbindung in beide Richtungen. key kennzeichnet Einträge aus dem Standardkatalog.
 */
export const ruleCatalogItem = pgTable(
  'rule_catalog_item',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    key: text(),
    kind: text({ enum: ['right', 'obligation'] }).notNull(),
    group: text({ enum: ['cost', 'protection', 'collaboration', 'growth'] }).notNull(),
    title: jsonb().$type<CatalogText>().notNull(),
    description: jsonb().$type<CatalogText>().notNull(),
    counterpartId: uuid().references((): AnyPgColumn => ruleCatalogItem.id, {
      onDelete: 'set null',
    }),
    minImpactLevel: smallint().notNull(),
    position: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    check('rule_catalog_item_kind', sql`${table.kind} in ('right', 'obligation')`),
    check(
      'rule_catalog_item_group',
      sql`${table.group} in ('cost', 'protection', 'collaboration', 'growth')`,
    ),
    check('rule_catalog_item_level', sql`${table.minImpactLevel} between 1 and 3`),
    check('rule_catalog_item_title', bilingual('title')),
    check('rule_catalog_item_description', bilingual('description')),
    check('rule_catalog_item_not_self', sql`${table.counterpartId} <> ${table.id}`),
    uniqueIndex('rule_catalog_item_key').on(table.orgId, table.key),
    index('rule_catalog_item_org').on(table.orgId),
  ],
);

/** Formate der Zusammenarbeit je Käuferorganisation (PLB-01), org_private. */
export const formatCatalogItem = pgTable(
  'format_catalog_item',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    key: text(),
    name: jsonb().$type<CatalogText>().notNull(),
    purpose: jsonb().$type<CatalogText>().notNull(),
    level: text({ enum: ['executive', 'management', 'operational'] }).notNull(),
    cadence: text({
      enum: ['monthly', 'quarterly', 'semiannual', 'annual', 'on_demand'],
    }).notNull(),
    minImpactLevel: smallint().notNull(),
    // Leer: für jede Beziehungsqualität.
    forQualityLevels: smallint().array().notNull().default(sql`'{}'::smallint[]`),
    position: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    check(
      'format_catalog_item_level',
      sql`${table.level} in ('executive', 'management', 'operational')`,
    ),
    check(
      'format_catalog_item_cadence',
      sql`${table.cadence} in ('monthly', 'quarterly', 'semiannual', 'annual', 'on_demand')`,
    ),
    check('format_catalog_item_impact', sql`${table.minImpactLevel} between 1 and 3`),
    check('format_catalog_item_quality', sql`${table.forQualityLevels} <@ '{1,2,3}'::smallint[]`),
    check('format_catalog_item_name', bilingual('name')),
    check('format_catalog_item_purpose', bilingual('purpose')),
    uniqueIndex('format_catalog_item_key').on(table.orgId, table.key),
    index('format_catalog_item_org').on(table.orgId),
  ],
);

/**
 * Wann der Standardkatalog in die Organisation kopiert wurde (PLB-01), org_private. Einmalig:
 * Gelöschte Einträge kommen nicht zurück.
 */
export const catalogSetup = pgTable('catalog_setup', {
  orgId: uuid()
    .primaryKey()
    .references(() => organization.id),
  seededAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
});
