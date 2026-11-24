import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  pgView,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { appUser, userFunctions } from './app-user.js';
import { businessUnit, materialGroup, materialGroupProductGroup } from './master-data.js';
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
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
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
    focusSetBy: text().references(() => appUser.id),
    focusSetAt: timestamp({ withTimezone: true }),
    // KI-15: Konzernverbund aus Sicht dieser Seite; entsteht nur nach Bestätigung durch einen Menschen
    parentRelationshipId: uuid().references((): AnyPgColumn => relationship.id),
  },
  (table) => [unique('relationship_side_je_seite').on(table.relationshipId, table.orgId)],
);

export const spendSources = ['manual', 'import', 'seed'] as const;
/** SPL-04: Ist oder Plan. */
export const spendKinds = ['actual', 'plan'] as const;

export const cycleStatuses = ['active', 'closed'] as const;

/** Jahreszyklus der Käuferorganisation, geschützt wie Spend durch die buyer-private Session. */
export const cycle = pgTable(
  'cycle',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid('relationship_id')
      .notNull()
      .references(() => relationship.id),
    label: text().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().default(sql`app_now()`),
    jbpDate: date('jbp_date'),
    status: text({ enum: cycleStatuses }).notNull().default('active'),
    /** ZYK-05: wann der nächste Zyklus diesen abgelöst hat; offen bei aktiven Zyklen */
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => [
    check('cycle_status', sql`${table.status} in ('active', 'closed')`),
    index('cycle_relationship').on(table.relationshipId, table.startedAt),
    unique('cycle_id_relationship').on(table.id, table.relationshipId),
    uniqueIndex('cycle_one_active').on(table.relationshipId).where(sql`${table.status} = 'active'`),
  ],
);

export const cycleSettingSteps = [
  'feedback',
  'touchpoints',
  'supplierPlan',
  'jbp',
  'scorecard',
] as const;

/** Organisationsweite Abstände zum JBP-Termin (ZYK-02), nur für den Käufer sichtbar. */
export const cycleSetting = pgTable(
  'cycle_setting',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organization.id),
    step: text({ enum: cycleSettingSteps }).notNull(),
    weeksRelativeToJbp: integer('weeks_relative_to_jbp').notNull(),
    reminderDaysBefore: integer('reminder_days_before').notNull().default(7),
  },
  (table) => [
    unique('cycle_setting_je_schritt').on(table.orgId, table.step),
    check(
      'cycle_setting_step',
      sql`${table.step} in ('feedback', 'touchpoints', 'supplierPlan', 'jbp', 'scorecard')`,
    ),
    check('cycle_setting_wochen', sql`${table.weeksRelativeToJbp} between -104 and 104`),
    check('cycle_setting_erinnerung', sql`${table.reminderDaysBefore} between 0 and 365`),
  ],
);

/** Idempotenzschlüssel für Erinnerungen; enthält keine Mailadresse oder Mailinhalte. */
export const cycleReminderSent = pgTable(
  'cycle_reminder_sent',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    cycleId: uuid('cycle_id')
      .notNull()
      .references(() => cycle.id),
    relationshipId: uuid('relationship_id')
      .notNull()
      .references(() => relationship.id),
    step: text({ enum: cycleSettingSteps }).notNull(),
    dueDate: date('due_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    unique('cycle_reminder_sent_je_faelligkeit').on(table.cycleId, table.step, table.dueDate),
    check(
      'cycle_reminder_sent_step',
      sql`${table.step} in ('feedback', 'touchpoints', 'supplierPlan', 'jbp', 'scorecard')`,
    ),
  ],
);

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
    // SPL-04: Ist oder Plan, optional aufgeteilt nach Business Unit und Warengruppe. Ohne Aufteilung
    // gilt die Zeile für den ganzen Lieferanten; die Summe eines Jahres liefert relationship_spend_total.
    kind: text({ enum: spendKinds }).notNull().default('actual'),
    businessUnitId: uuid().references(() => businessUnit.id),
    materialGroupId: uuid().references(() => materialGroup.id),
    // WG-01: optional die Produktgruppe innerhalb der Warengruppe
    productGroupId: uuid().references(() => materialGroupProductGroup.id),
  },
  (table) => [
    unique('relationship_spend_je_eintrag')
      .on(table.relationshipId, table.year, table.kind, table.businessUnitId, table.materialGroupId)
      .nullsNotDistinct(),
    check('relationship_spend_art', sql`${table.kind} in ('actual', 'plan')`),
    check('relationship_spend_positiv', sql`${table.amountCents} >= 0`),
    check('relationship_spend_waehrung_iso', sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check('relationship_spend_quelle', sql`${table.source} in ('manual', 'import', 'seed')`),
  ],
);

/** SPL-04: Ist-Spend je Lieferant, Jahr und Währung (Summe aller Zeilen); Sicht mit RLS. */
export const relationshipSpendTotal = pgView('relationship_spend_total', {
  relationshipId: uuid('relationship_id').notNull(),
  year: integer().notNull(),
  currency: text().notNull(),
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
}).existing();

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
    // PLB-04: ohne Fremdschlüssel auf app_user (privat), wie andere geteilte Tabellen.
    userId: text().notNull(),
    teamRole: text({ enum: teamRoles }).notNull().default('member'),
    function: text({ enum: userFunctions }),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
    /** PLB-04: Seite der Person (geteilte Ebene); gleich org_id, ein Trigger füllt es */
    ownerOrgId: uuid().references(() => organization.id),
    /** PLB-04: geteilt sieht die andere Seite; Standard intern, SRO und Sponsoren geteilt */
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('internal'),
    /** PLB-04: Name der Person, damit die andere Seite geteilte Mitglieder lesen kann */
    memberName: text(),
  },
  (table) => [
    unique('relationship_member_je_person').on(table.relationshipId, table.orgId, table.userId),
    check(
      'relationship_member_owner',
      sql`${table.ownerOrgId} is not null and ${table.ownerOrgId} = ${table.orgId}`,
    ),
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

/**
 * PLB-04: Beschreibung einer Teamrolle je Organisation (org_private), z. B. was der SRO macht und
 * was nicht. Ohne Zeile gilt der Standard aus packages/shared.
 */
export const roleDescription = pgTable(
  'role_description',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    role: text().notNull(),
    does: jsonb().notNull(),
    doesNot: jsonb().notNull(),
    updatedBy: text().notNull(),
    updatedByName: text().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    unique('role_description_role').on(table.orgId, table.role),
    check(
      'role_description_lists',
      sql`jsonb_typeof(${table.does}) = 'array' and jsonb_typeof(${table.doesNot}) = 'array'`,
    ),
  ],
);
