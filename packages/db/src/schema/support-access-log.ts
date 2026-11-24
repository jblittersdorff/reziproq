import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organization } from './organization.js';

// Protokoll des Betreiber-Zugangs (PLT-13, UMB-01): wer von Reziproq wann in welchen Kunden
// geschaut hat. Gehört zum Betrieb, nicht zu einem Kunden; die API schreibt nur über eine
// Datenbankfunktion und liest nie.
export const supportAccessLog = pgTable('support_access_log', {
  id: uuid().primaryKey().default(sql`uuidv7()`),
  // sub aus dem Zitadel-Token, wie app_user.id
  userId: text().notNull(),
  // leer beim Abruf der Kundenliste
  organizationId: uuid().references(() => organization.id, { onDelete: 'set null' }),
  // Methode und Pfad, z. B. GET /api/suppliers
  action: text().notNull(),
  occurredAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
});
