import { sql } from 'drizzle-orm';
import { check, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const organizationType = pgEnum('organization_typ', ['kaeufer', 'lieferant']);

// Eine Organisation ist ein Mandant: ein Käufer- oder Lieferantenunternehmen.
// Ein Lieferant existiert genau einmal und kann mehreren Käufern zugeordnet sein (PLT-02).
// Row-Level Security: Policies in drizzle/0004_rls.sql.
export const organization = pgTable(
  'organization',
  {
    // uuidv7() ist ab PostgreSQL 18 eingebaut und zeitlich sortierbar.
    id: uuid().primaryKey().default(sql`uuidv7()`),
    name: text().notNull(),
    typ: organizationType().notNull(),
    // ISO-3166-1-Code, z. B. DE
    land: text(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [check('organization_land_iso', sql`${table.land} ~ '^[A-Z]{2}$'`)],
);
