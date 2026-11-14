import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { organization } from './organization.js';
import { cycle, relationship } from './relationship.js';

// PLB-06: Kontaktpunkte einer Beziehung. Geteilt mit visibility, Standard intern; nur der Käufer
// legt sie an. Personen stehen als ID und Name ohne Fremdschlüssel: app_user und die Kontakte
// des Lieferanten (PLT-07, käuferprivat) sind für die andere Seite privat. Den Verweis auf einen
// Kontakt hat nur eine interne Zeile (Prüfung unten); geteilte Zeilen tragen nur den Namen.

export const touchpointLevels = ['executive', 'management', 'operational'] as const;
export const touchpointCadences = [
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
  'on_demand',
] as const;

export const touchpoint = pgTable(
  'touchpoint',
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
    buyerUserId: text(),
    buyerName: text().notNull(),
    buyerLevel: text({ enum: touchpointLevels }).notNull(),
    supplierContactId: uuid(),
    supplierName: text().notNull(),
    supplierLevel: text({ enum: touchpointLevels }).notNull(),
    format: text().notNull(),
    cadence: text({ enum: touchpointCadences }).notNull(),
    notes: text(),
    createdBy: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'touchpoint_levels',
      sql`${table.buyerLevel} in ('executive', 'management', 'operational') and ${table.supplierLevel} in ('executive', 'management', 'operational')`,
    ),
    check(
      'touchpoint_cadence',
      sql`${table.cadence} in ('monthly', 'quarterly', 'semiannual', 'annual', 'on_demand')`,
    ),
    check(
      'touchpoint_contact_internal',
      sql`${table.visibility} = 'internal' or ${table.supplierContactId} is null`,
    ),
    check(
      'touchpoint_texts',
      sql`length(trim(${table.buyerName})) between 1 and 120 and length(trim(${table.supplierName})) between 1 and 120 and length(trim(${table.format})) between 1 and 120`,
    ),
    index('touchpoint_relationship').on(table.relationshipId),
  ],
);

/** PLB-06: „Kontaktpunkte geprüft“ je Zyklus, käuferprivat; erledigt den Zyklus-Schritt. */
export const touchpointReview = pgTable(
  'touchpoint_review',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    cycleId: uuid()
      .notNull()
      .references(() => cycle.id),
    reviewedBy: text().notNull(),
    reviewedByName: text().notNull(),
    reviewedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('touchpoint_review_je_zyklus').on(table.cycleId)],
);
