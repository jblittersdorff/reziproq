import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// PLT-06: Business Units und Warengruppen je Organisation und ihre Zuordnung zu Lieferanten.
// Benutzte Einträge werden nur deaktiviert; die Fremdschlüssel der Zuordnungen verhindern das
// Löschen. Dass nur eigene Einträge zugeordnet werden, prüft ein Trigger (drizzle/0017).

export const businessUnit = pgTable(
  'business_unit',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    name: text().notNull(),
    code: text().notNull(),
    active: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Codes sind je Organisation eindeutig, ohne Rücksicht auf Groß- und Kleinschreibung.
    uniqueIndex('business_unit_code').on(table.orgId, sql`lower(${table.code})`),
  ],
);

export const materialGroup = pgTable(
  'material_group',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    name: text().notNull(),
    code: text().notNull(),
    // Höchstens zwei Ebenen; eine Oberebene mit Untergruppen lässt sich nicht löschen.
    parentId: uuid().references((): AnyPgColumn => materialGroup.id),
    active: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('material_group_code').on(table.orgId, sql`lower(${table.code})`),
    index('material_group_parent').on(table.parentId),
  ],
);

export const relationshipBusinessUnit = pgTable(
  'relationship_business_unit',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    businessUnitId: uuid()
      .notNull()
      .references(() => businessUnit.id),
  },
  (table) => [
    unique('relationship_business_unit_once').on(table.relationshipId, table.businessUnitId),
    index('relationship_business_unit_unit').on(table.businessUnitId),
  ],
);

export const relationshipMaterialGroup = pgTable(
  'relationship_material_group',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    materialGroupId: uuid()
      .notNull()
      .references(() => materialGroup.id),
    isPrimary: boolean().notNull().default(false),
  },
  (table) => [
    unique('relationship_material_group_once').on(table.relationshipId, table.materialGroupId),
    // Genau eine Haupt-Warengruppe je Beziehung, sobald es Warengruppen gibt.
    uniqueIndex('relationship_material_group_primary')
      .on(table.relationshipId)
      .where(sql`${table.isPrimary}`),
    index('relationship_material_group_group').on(table.materialGroupId),
  ],
);
