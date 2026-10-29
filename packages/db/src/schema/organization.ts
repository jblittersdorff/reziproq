import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Eine Organisation ist ein Mandant: ein Käufer- oder Lieferantenunternehmen.
// Row-Level Security folgt mit der Mandanten-Session (siehe docs/specs/AUTH-01.md).
export const organization = pgTable('organization', {
  // uuidv7() ist ab PostgreSQL 18 eingebaut und zeitlich sortierbar.
  id: uuid().primaryKey().default(sql`uuidv7()`),
  name: text().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
