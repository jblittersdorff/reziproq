import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { appUser } from './app-user.js';
import { filedMail } from './mail.js';
import { organization } from './organization.js';
import { relationship } from './relationship.js';
import { supplierContact } from './supplier-contact.js';

/** Wofür ein Link gilt (BL-01); Beiträge und Wertbuchungen kommen mit K3 und K4 */
export const confirmLinkPurposes = ['commitment'] as const;
export const confirmLinkResults = ['confirmed', 'declined'] as const;

/**
 * Bestätigen per Link (BL-01, K2-d): Ein Link gehört genau einer Person des Lieferanten und nennt
 * genau die Objekte, um die es geht (E-K2-13). org_private der Käuferseite, die ihn erzeugt hat;
 * der Lieferant liest ihn nur über die Funktionen app_bestaetigen_* mit dem Token. Gespeichert ist
 * nur der SHA-256 des Tokens und des Einmalcodes (E-K0-06), nie Token oder Code selbst.
 */
export const confirmLink = pgTable(
  'confirm_link',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    // Ansprechpartner ohne Konto; Name und Adresse stehen zusätzlich am Link, damit er hält
    contactId: uuid().references(() => supplierContact.id, { onDelete: 'set null' }),
    name: text().notNull(),
    email: text().notNull(),
    purpose: text({ enum: confirmLinkPurposes }).notNull().default('commitment'),
    objectIds: uuid().array().notNull(),
    // Die Mail, aus der die Zusagen stammen („Aus Ihrer Mail vom …“)
    sourceMailId: uuid().references(() => filedMail.id, { onDelete: 'set null' }),
    tokenHash: text().notNull().unique('confirm_link_token_hash'),
    createdBy: text()
      .notNull()
      .references(() => appUser.id),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
    // 14 Tage (E-K2-6)
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    // Einmalcode an die Adresse der Person, 10 Minuten gültig, höchstens fünf Versuche (E-K0-06)
    codeHash: text(),
    codeExpiresAt: timestamp({ withTimezone: true }),
    codeAttempts: integer().notNull().default(0),
    verifiedAt: timestamp({ withTimezone: true }),
    usedAt: timestamp({ withTimezone: true }),
    result: text({ enum: confirmLinkResults }),
    reason: text(),
  },
  (table) => [
    check('confirm_link_purpose', sql`${table.purpose} in ('commitment')`),
    check(
      'confirm_link_result',
      sql`${table.result} is null or ${table.result} in ('confirmed', 'declined')`,
    ),
    check('confirm_link_token_hash_form', sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
    check(
      'confirm_link_code_hash_form',
      sql`${table.codeHash} is null or ${table.codeHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check('confirm_link_objects', sql`cardinality(${table.objectIds}) between 1 and 20`),
    check('confirm_link_used', sql`(${table.usedAt} is null) = (${table.result} is null)`),
    check('confirm_link_reason', sql`${table.reason} is null or length(${table.reason}) <= 1000`),
    index('confirm_link_relationship').on(table.relationshipId),
  ],
);

/**
 * Passkey der Person für genau diesen Link (E-K0-06, E-K2-14): Reziproq prüft ihn selbst mit
 * WebAuthn. Ein weitergeleiteter Link scheitert am Einmalcode und danach am Passkey.
 */
export const confirmCredential = pgTable(
  'confirm_credential',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    linkId: uuid()
      .notNull()
      .references(() => confirmLink.id, { onDelete: 'cascade' }),
    // Kennung und öffentlicher Schlüssel des Passkeys (base64url), Zähler gegen Klone
    credentialId: text().notNull().unique('confirm_credential_id'),
    publicKey: text().notNull(),
    counter: bigint({ mode: 'number' }).notNull().default(0),
    transports: jsonb().$type<string[]>().notNull().default([]),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [index('confirm_credential_link').on(table.linkId)],
);
