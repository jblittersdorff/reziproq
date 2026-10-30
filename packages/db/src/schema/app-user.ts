import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

// Eine Person, die sich über Zitadel angemeldet hat. Name und E-Mail kommen vom
// Userinfo-Endpunkt und werden bei jedem Aufruf von /api/me aktualisiert.
// Personen gehören keiner einzelnen Beziehung; Zuordnung zu Organisationen folgt später.
export const appUser = pgTable('app_user', {
  // sub aus dem Zitadel-Token; keine UUID, sondern die Nutzer-ID von Zitadel.
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
