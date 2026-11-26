import { sql } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { organization } from './organization.js';

/**
 * DM-01 (K1-g.1): Protokoll der Demo-Regie. Jede Aktion der Regie (Zeit, Signal, Rolle, Modus,
 * Zurücksetzen) steht hier mit der Demo-Uhr, zu der sie geschah. Nur Demo-Mandanten (Policy in
 * Migration 0139); es überdauert das Zurücksetzen.
 */
export const demoEvent = pgTable('demo_event', {
  id: uuid().primaryKey().default(sql`uuidv7()`),
  orgId: uuid()
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' }),
  /** Art der Aktion, z. B. zeit.neuer_tag, zuruecksetzen, signal.mail_kim_kaiser */
  kind: text().notNull(),
  payload: jsonb().notNull().default({}),
  /** Person der Demo-Sitzung, die die Regie bedient hat; ohne Fremdschlüssel, weil das Zurücksetzen
   * die Personen neu anlegt */
  actorUserId: text(),
  /** Demo-Uhr nach der Aktion */
  demoNow: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
});

/**
 * DM-01 (K1-g.1): Stand der Demo als Schnappschuss. „start“ entsteht beim Seed von Nordwind; das
 * Zurücksetzen lädt ihn wieder. Die Zeilen aller Organisationen der Demo stehen je Tabelle in
 * data; seed_version ist ein Hash davon. Weitere Stände (K4 „21.12.“ u. a.) kommen mit ihren
 * Drehbüchern. Nur über Funktionen der Migration 0139 lesbar und schreibbar.
 */
export const demoSnapshot = pgTable(
  'demo_snapshot',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    key: text().notNull(),
    demoNow: timestamp({ withTimezone: true }),
    seedVersion: text().notNull(),
    data: jsonb().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [unique('demo_snapshot_stand').on(table.orgId, table.key)],
);
