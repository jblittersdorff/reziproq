import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { appUser, userFunctions } from './app-user.js';
import { organization } from './organization.js';

// PLT-03: Beziehung zwischen einem Käufer und einem Lieferanten. Ein Lieferant existiert in
// Reziproq nur einmal; jeder Käufer hat zu ihm höchstens eine Beziehung. Beziehungen werden nie
// gelöscht, nur beendet.

export const relationshipStatuses = ['draft', 'active', 'ended'] as const;
export type RelationshipStatus = (typeof relationshipStatuses)[number];

/**
 * Geteilt (PLT-04), als Anker aller Beziehungsdaten mit eigenen Policies: Der Käufer sieht alle
 * seine Beziehungen, der Lieferant nur aktive und nur im Kontext dieses Kunden.
 */
export const relationship = pgTable(
  'relationship',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    buyerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    supplierOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    status: text({ enum: relationshipStatuses }).notNull().default('draft'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    unique('relationship_paar').on(table.buyerOrgId, table.supplierOrgId),
    check('relationship_status', sql`${table.status} in ('draft', 'active', 'ended')`),
    check('relationship_nicht_mit_sich_selbst', sql`${table.buyerOrgId} <> ${table.supplierOrgId}`),
  ],
);

/**
 * Was jede Seite für sich zu einer Beziehung festhält (org_private): eigener Anzeigename, eigene
 * Lieferanten- bzw. Kundennummer, Notizen und ab SEG-02 der Fokus. Die andere Seite sieht nichts.
 */
export const relationshipSide = pgTable(
  'relationship_side',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    displayName: text(),
    externalRef: text(),
    notes: text(),
    isFocus: boolean().notNull().default(false),
    focusReason: text(),
  },
  (table) => [unique('relationship_side_je_seite').on(table.relationshipId, table.orgId)],
);

export const spendSources = ['manual', 'import', 'seed'] as const;

/** Spend je Jahr, nur für den Käufer (buyer_private). Geld als ganze Cent mit Währung. */
export const relationshipSpend = pgTable(
  'relationship_spend',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    year: integer().notNull(),
    // bigint, weil integer nur bis etwa 21 Mio. Euro reicht.
    amountCents: bigint({ mode: 'number' }).notNull(),
    currency: text().notNull().default('EUR'),
    source: text({ enum: spendSources }).notNull().default('manual'),
  },
  (table) => [
    unique('relationship_spend_je_jahr').on(table.relationshipId, table.year),
    check('relationship_spend_positiv', sql`${table.amountCents} >= 0`),
    check('relationship_spend_waehrung_iso', sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check('relationship_spend_quelle', sql`${table.source} in ('manual', 'import', 'seed')`),
  ],
);

/** Rolle im Team einer Beziehung (PLT-05). */
export const teamRoles = ['sro', 'sponsor', 'member', 'viewer'] as const;
export type TeamRole = (typeof teamRoles)[number];

/**
 * Internes Team einer Seite je Beziehung (org_private, PLT-05): SRO, bis zu zwei Sponsoren,
 * Mitglieder und Leser. Die Teamrolle Leser macht die Beziehung für diese Person schreibgeschützt.
 * PLB-04 macht daraus ein geteiltes Team.
 */
export const relationshipMember = pgTable(
  'relationship_member',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    userId: text()
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    teamRole: text({ enum: teamRoles }).notNull().default('member'),
    function: text({ enum: userFunctions }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('relationship_member_je_person').on(table.relationshipId, table.orgId, table.userId),
    uniqueIndex('relationship_member_ein_sro')
      .on(table.relationshipId, table.orgId)
      .where(sql`${table.teamRole} = 'sro'`),
    check(
      'relationship_member_team_role',
      sql`${table.teamRole} in ('sro', 'sponsor', 'member', 'viewer')`,
    ),
    check(
      'relationship_member_function',
      sql`${table.function} in ('purchasing', 'quality', 'engineering', 'logistics', 'programs', 'after_sales')`,
    ),
  ],
);
