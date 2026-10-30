import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organization } from './organization.js';

// Eine Person, die sich über Zitadel angemeldet hat. Name und E-Mail kommen vom
// Userinfo-Endpunkt und werden bei jedem Aufruf von /api/me aktualisiert.
// Jede Person gehört zu höchstens einer Organisation (PLT-02).
export const appUser = pgTable('app_user', {
  // sub aus dem Zitadel-Token; keine UUID, sondern die Nutzer-ID von Zitadel.
  id: text().primaryKey(),
  name: text().notNull(),
  // Vorname aus given_name von Zitadel; fehlt er, gilt das erste Wort des Namens.
  givenName: text('given_name'),
  email: text().notNull(),
  organizationId: uuid('organization_id').references(() => organization.id, {
    onDelete: 'set null',
  }),
  // Zeitpunkt der letzten abgeschlossenen Anmeldung; die App meldet sie nach jedem Login (PLT-01).
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
