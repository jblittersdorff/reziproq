import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { appUser } from './app-user.js';
import { organization } from './organization.js';

const time = () => timestamp({ withTimezone: true });

/** Eine Domain der Organisation mit dem DNS-Eintrag zur Bestätigung */
export interface SsoDomain {
  domain: string;
  recordName: string;
  recordValue: string;
  verifiedAt: string | null;
}

/**
 * IN-02: Anmeldung über Microsoft Entra ID oder Google Workspace je Organisation. Die Anbieter
 * stehen in Zitadel (idp_ref); hier stehen Mandant bzw. Domain, die Domains mit Bestätigung, die
 * Standardrolle neuer Personen und ob die Anmeldung mit Passwort noch erlaubt ist. org_private.
 */
export const orgSso = pgTable(
  'org_sso',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    provider: text({ enum: ['entra', 'google'] }).notNull(),
    tenantId: text(),
    hostedDomain: text(),
    domains: jsonb().$type<SsoDomain[]>().notNull().default([]),
    defaultRole: text({ enum: ['admin', 'member', 'viewer'] }).notNull().default('viewer'),
    passwordLoginAllowed: boolean().notNull().default(true),
    status: text({ enum: ['draft', 'active'] }).notNull().default('draft'),
    idpRef: text(),
    updatedBy: text().notNull(),
    updatedAt: time().notNull().defaultNow(),
  },
  (table) => [
    unique('org_sso_provider').on(table.orgId, table.provider),
    check('org_sso_provider_check', sql`${table.provider} in ('entra', 'google')`),
    check('org_sso_status', sql`${table.status} in ('draft', 'active')`),
    check('org_sso_role', sql`${table.defaultRole} in ('admin', 'member', 'viewer')`),
    check(
      'org_sso_ziel',
      sql`(${table.provider} = 'entra') = (${table.tenantId} is not null) and (${table.provider} = 'google') = (${table.hostedDomain} is not null)`,
    ),
  ],
);

/**
 * IN-02: Externe Identität einer Person (Anbieter + Subject). Eine Person wird darüber erkannt,
 * nicht über die Mail. Nur die Anmelde-Funktionen lesen und schreiben sie.
 */
export const userIdentity = pgTable(
  'user_identity',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    userId: text()
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    provider: text({ enum: ['entra', 'google'] }).notNull(),
    subject: text().notNull(),
    email: text().notNull(),
    lastLoginAt: time().notNull().defaultNow(),
  },
  (table) => [
    unique('user_identity_subject').on(table.provider, table.subject),
    index('user_identity_user').on(table.userId),
  ],
);
