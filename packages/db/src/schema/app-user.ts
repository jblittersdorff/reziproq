import { sql } from 'drizzle-orm';
import { boolean, check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organization } from './organization.js';

// Eine Person, die sich über Zitadel angemeldet hat. Name und E-Mail kommen vom
// Userinfo-Endpunkt und werden bei jedem Aufruf von /api/me aktualisiert.
// Jede Person gehört zu höchstens einer Organisation (PLT-02).

/** Rolle in der Organisation (PLT-05): genau eine je Nutzer, neue Nutzer sind viewer. */
export const orgRoles = ['admin', 'member', 'viewer'] as const;
export type OrgRole = (typeof orgRoles)[number];

/** Funktion einer Person, z. B. als Vorgabe für Teams (PLT-05). */
export const userFunctions = [
  'purchasing',
  'quality',
  'engineering',
  'logistics',
  'programs',
  'after_sales',
] as const;

/** Sprache der Oberfläche und späterer E-Mails (PLT-09). */
export const userLocales = ['de', 'en'] as const;
export type UserLocale = (typeof userLocales)[number];

export const appUser = pgTable(
  'app_user',
  {
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
    // Rollen liegen in der Datenbank, nicht in Zitadel (PLT-05).
    orgRole: text('org_role', { enum: orgRoles }).notNull().default('viewer'),
    // Zusatzrolle Controlling, kombinierbar mit jeder Rolle; gibt später GuV-Wirkungen frei (PNL-06).
    isControlling: boolean('is_controlling').notNull().default(false),
    defaultFunction: text('default_function', { enum: userFunctions }),
    // Wann die Rollen einmalig aus dem Zitadel-Token übernommen wurden; danach zählt nur die Datenbank.
    rolesImportedAt: timestamp('roles_imported_at', { withTimezone: true }),
    // Betreiber-Team von Reziproq (UMB-01); gesetzt nur per pnpm operator:set, nie über die API.
    isOperator: boolean('is_operator').notNull().default(false),
    // Sprache (PLT-09). Leer, bis die Person sich anmeldet; dann gilt die Browsersprache, bis sie
    // auf /profil/sprache eine andere wählt. Leer gilt als Deutsch.
    locale: text('locale', { enum: userLocales }),
  },
  (table) => [
    check('app_user_locale', sql`${table.locale} in ('de', 'en')`),
    check('app_user_org_role', sql`${table.orgRole} in ('admin', 'member', 'viewer')`),
    check(
      'app_user_default_function',
      sql`${table.defaultFunction} in ('purchasing', 'quality', 'engineering', 'logistics', 'programs', 'after_sales')`,
    ),
  ],
);
