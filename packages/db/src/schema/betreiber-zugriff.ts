import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organization } from './organization.js';

// Protokoll des Betreiber-Zugangs (PLT-13): wer von Reziproq wann in welchen Kunden geschaut hat.
// Gehört zum Betrieb, nicht zu einem Kunden; die Rolle reziproq_app hat darauf keinen Zugriff.
export const betreiberZugriff = pgTable('betreiber_zugriff', {
  id: uuid().primaryKey().default(sql`uuidv7()`),
  // sub aus dem Zitadel-Token, wie app_user.id
  nutzerId: text('nutzer_id').notNull(),
  // leer beim Abruf der Kundenliste
  organizationId: uuid('organization_id').references(() => organization.id, {
    onDelete: 'set null',
  }),
  // Methode und Pfad, z. B. GET /api/suppliers
  aktion: text().notNull(),
  zeitpunkt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
