import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { appUser } from './app-user.js';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

/** Rolle, die eine eingeladene Person in ihrer Organisation bekommt; die erste wird immer Admin. */
export const invitationRoles = ['admin', 'member'] as const;
export type InvitationRole = (typeof invitationRoles)[number];

/**
 * Einladung einer Person des Lieferanten (LIF-01). org_private der einladenden Organisation: Der
 * Lieferant sieht die Zeile nie. Gespeichert ist nur der SHA-256 des Tokens, nie der Token selbst.
 * Die Annahme läuft ohne Login über die Funktionen app_einladung_* (Migration 0035).
 */
export const invitation = pgTable(
  'invitation',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    email: text().notNull(),
    role: text({ enum: invitationRoles }).notNull().default('member'),
    message: text(),
    tokenHash: text().notNull().unique('invitation_token_hash'),
    invitedBy: text()
      .notNull()
      .references(() => appUser.id),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedAt: timestamp({ withTimezone: true }),
    acceptedUserId: text().references(() => appUser.id),
    revokedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    check('invitation_role', sql`${table.role} in ('admin', 'member')`),
    check('invitation_token_hash_form', sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
    check('invitation_message_length', sql`length(${table.message}) <= 500`),
    check(
      'invitation_accepted_or_revoked',
      sql`${table.acceptedAt} IS NULL OR ${table.revokedAt} IS NULL`,
    ),
    index('invitation_relationship').on(table.relationshipId),
  ],
);
