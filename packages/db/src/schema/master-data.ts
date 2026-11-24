import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { appUser } from './app-user.js';
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
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
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
    // WG-01: Beschreibung, Lead (koordiniert das Team) und optional Commodity Manager
    description: text(),
    leadUserId: text().references(() => appUser.id),
    commodityManagerUserId: text().references(() => appUser.id),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
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
    // WG-01: entsteht automatisch aus Spend (Trigger) oder manuell, z. B. ohne Umsatz
    source: text({ enum: ['spend', 'manual'] })
      .notNull()
      .default('manual'),
  },
  (table) => [
    unique('relationship_material_group_once').on(table.relationshipId, table.materialGroupId),
    // Genau eine Haupt-Warengruppe je Beziehung, sobald es Warengruppen gibt.
    uniqueIndex('relationship_material_group_primary')
      .on(table.relationshipId)
      .where(sql`${table.isPrimary}`),
    index('relationship_material_group_group').on(table.materialGroupId),
    check('relationship_material_group_source', sql`${table.source} in ('spend', 'manual')`),
  ],
);

// WG-01: Produktgruppen untergliedern eine Warengruppe; das Team je Warengruppe mit Rolle.
export const materialGroupMemberRoles = ['lead', 'commodity_manager', 'buyer', 'function'] as const;

export const materialGroupProductGroup = pgTable(
  'material_group_product_group',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    materialGroupId: uuid()
      .notNull()
      .references(() => materialGroup.id),
    name: text().notNull(),
    description: text(),
    position: integer().notNull().default(0),
  },
  (table) => [
    index('material_group_product_group_group').on(table.materialGroupId),
    uniqueIndex('material_group_product_group_name').on(
      table.materialGroupId,
      sql`lower(${table.name})`,
    ),
  ],
);

export const materialGroupMember = pgTable(
  'material_group_member',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    materialGroupId: uuid()
      .notNull()
      .references(() => materialGroup.id),
    userId: text()
      .notNull()
      .references(() => appUser.id),
    role: text({ enum: materialGroupMemberRoles }).notNull(),
    businessUnitId: uuid().references(() => businessUnit.id),
    region: text(),
    task: text(),
  },
  (table) => [
    check(
      'material_group_member_role',
      sql`${table.role} in ('lead', 'commodity_manager', 'buyer', 'function')`,
    ),
    unique('material_group_member_once').on(table.materialGroupId, table.userId, table.role),
    index('material_group_member_group').on(table.materialGroupId),
  ],
);
