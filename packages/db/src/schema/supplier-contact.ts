import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { relationship } from './relationship.js';

/** Geschäftliche Lieferantenkontakte, ausschließlich für den Käufer sichtbar (PLT-07b). */
export const supplierContact = pgTable(
  'supplier_contact',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    email: text().notNull(),
    function: text(),
    position: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('supplier_contact_email').on(table.relationshipId, sql`lower(${table.email})`),
    index('supplier_contact_relationship').on(table.relationshipId),
  ],
);
