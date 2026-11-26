import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { confirmColumns, confirmConstraint, originColumns, originConstraint } from './columns.js';
import { jbp, jbpTopic } from './jbp.js';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// JBP-03: Gemeinsame Initiativen mit Meilensteinen, geteilt. Eine Zeile gehört der Seite, die sie
// angelegt hat; Änderungen der anderen Seite laufen über die Funktionen app_initiative_* (0046).

export const initiativeStatuses = ['planned', 'running', 'done', 'stopped'] as const;

export const initiative = pgTable(
  'initiative',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('shared'),
    jbpId: uuid()
      .notNull()
      .references(() => jbp.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    goal: text().notNull(),
    benefitBuyer: text().notNull(),
    benefitSupplier: text().notNull(),
    // Verantwortliche beider Seiten; Personen nur mit Namen, nie bewertet.
    ownerBuyerUserId: text(),
    ownerBuyerName: text().notNull(),
    ownerSupplierUserId: text(),
    ownerSupplierName: text().notNull(),
    startsOn: date().notNull(),
    endsOn: date().notNull(),
    status: text({ enum: initiativeStatuses }).notNull().default('planned'),
    // PNL-01: Woher die Initiative kommt; vom Lieferanten angelegt ist sie eine Lieferantenidee.
    source: text({ enum: ['jbp', 'action', 'supplier_idea'] })
      .notNull()
      .default('jbp'),
    createdBy: text().notNull(),
    createdByName: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
    updatedAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
    // ZA-01: Herkunft
    ...originColumns(),
  },
  (table) => [
    originConstraint('initiative', table.origin),
    check('initiative_status', sql`${table.status} in ('planned', 'running', 'done', 'stopped')`),
    check('initiative_source', sql`${table.source} in ('jbp', 'action', 'supplier_idea')`),
    check('initiative_title', sql`length(trim(${table.title})) between 1 and 200`),
    check('initiative_goal', sql`length(trim(${table.goal})) between 1 and 2000`),
    // Nutzen für beide Seiten ist Pflicht (JBP-03).
    check(
      'initiative_benefits',
      sql`length(trim(${table.benefitBuyer})) between 1 and 2000 and length(trim(${table.benefitSupplier})) between 1 and 2000`,
    ),
    check(
      'initiative_owners',
      sql`length(trim(${table.ownerBuyerName})) between 1 and 200 and length(trim(${table.ownerSupplierName})) between 1 and 200`,
    ),
    check('initiative_period', sql`${table.endsOn} >= ${table.startsOn}`),
    index('initiative_jbp').on(table.jbpId, table.startsOn),
  ],
);

/** Aus welchen Themen die Initiative zusammengeführt ist (JBP-02 → JBP-03), geteilt. */
export const initiativeTopic = pgTable(
  'initiative_topic',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('shared'),
    initiativeId: uuid()
      .notNull()
      .references(() => initiative.id, { onDelete: 'cascade' }),
    jbpTopicId: uuid()
      .notNull()
      .references(() => jbpTopic.id, { onDelete: 'cascade' }),
  },
  // Einmal je Thema sichert app_jbp_topic_merge: Nur Themen, die noch nicht merged sind.
  (table) => [index('initiative_topic_topic').on(table.jbpTopicId)],
);

export const initiativeMilestone = pgTable(
  'initiative_milestone',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('shared'),
    initiativeId: uuid()
      .notNull()
      .references(() => initiative.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    dueOn: date().notNull(),
    doneOn: date(),
  },
  (table) => [
    check('initiative_milestone_title', sql`length(trim(${table.title})) between 1 and 200`),
    index('initiative_milestone_initiative').on(table.initiativeId, table.dueOn),
  ],
);

// ZQ-01 (K2-a): Status, Art und Herkunft einer Zusage. Die Werte stehen englisch wie im übrigen
// Schema (Entscheidung des Gründers vom 26.11.2026): open = offen, kept = gehalten,
// missed = verfehlt, replaced = ersetzt, withdrawn = zurückgezogen.
export const commitmentStatuses = ['open', 'kept', 'missed', 'replaced', 'withdrawn'] as const;
/** commitment = Zusage; action = Maßnahme, nur für Altbestand (ZQ-01) */
export const commitmentKinds = ['commitment', 'action'] as const;
export const commitmentSourceTypes = [
  'mail',
  'meeting',
  'feedback',
  'hint',
  'manual',
  'deal',
  'initiative',
] as const;

/** Textstelle in einer Mail (ZQ-01 source_span), z. B. „[120,184)“ */
const int4range = customType<{ data: string; driverData: string }>({
  dataType: () => 'int4range',
});

/**
 * JBP-05, ZQ-01: Zusage einer Seite an die andere, geteilt. Sie hängt an der Beziehung, ein
 * Gemeinsamer Plan ist optional (E-K0-16). Jede Seite legt nur ihre eigenen Zusagen an
 * (owner_org_id ist die zusagende Seite); den Status ändern beide Seiten über app_zusage_status.
 * Verantwortlich ist eine Person der eigenen Seite; der Name steht dabei, damit die andere Seite
 * ihn sieht. Beschreibung und Erledigt-Zeitpunkt kommen aus den Maßnahmen (Abweichung von ZQ-01).
 */
export const commitment = pgTable(
  'commitment',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('shared'),
    jbpId: uuid().references(() => jbp.id, { onDelete: 'set null' }),
    initiativeId: uuid().references(() => initiative.id, { onDelete: 'set null' }),
    side: text({ enum: ['buyer', 'supplier'] }).notNull(),
    kind: text({ enum: commitmentKinds }).notNull().default('commitment'),
    title: text().notNull(),
    description: text(),
    /** Woran Erfüllung gemessen wird */
    measure: text(),
    ownerUserId: text(),
    ownerName: text().notNull(),
    dueOn: date().notNull(),
    status: text({ enum: commitmentStatuses }).notNull().default('open'),
    sourceType: text({ enum: commitmentSourceTypes }),
    sourceRef: uuid(),
    sourceSpan: int4range(),
    supersedesId: uuid().references((): AnyPgColumn => commitment.id, { onDelete: 'set null' }),
    conditionId: uuid().references((): AnyPgColumn => commitment.id, { onDelete: 'set null' }),
    /** Beleg der Buchung „gehalten“: Lieferavis, Wareneingang, Dokument, Bestätigung */
    fulfilledEvidence: jsonb(),
    doneAt: timestamp({ withTimezone: true }),
    createdBy: text().notNull(),
    createdByName: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
    updatedAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
    // ZA-01: Herkunft und Bestätigung
    ...originColumns(),
    ...confirmColumns(),
  },
  (table) => [
    originConstraint('commitment', table.origin),
    confirmConstraint('commitment', table.confirmState),
    check('commitment_side', sql`${table.side} in ('buyer', 'supplier')`),
    check(
      'commitment_status',
      sql`${table.status} in ('open', 'kept', 'missed', 'replaced', 'withdrawn')`,
    ),
    check('commitment_kind', sql`${table.kind} in ('commitment', 'action')`),
    check(
      'commitment_source_type',
      sql`${table.sourceType} is null or ${table.sourceType} in ('mail', 'meeting', 'feedback', 'hint', 'manual', 'deal', 'initiative')`,
    ),
    check(
      'commitment_measure',
      sql`${table.measure} is null or length(trim(${table.measure})) between 1 and 500`,
    ),
    check('commitment_not_self', sql`${table.supersedesId} is distinct from ${table.id}`),
    check('commitment_title', sql`length(trim(${table.title})) between 1 and 200`),
    check('commitment_owner', sql`length(trim(${table.ownerName})) between 1 and 200`),
    index('commitment_jbp').on(table.jbpId, table.dueOn),
    index('commitment_relationship').on(table.relationshipId, table.dueOn),
    index('commitment_supersedes').on(table.supersedesId),
    index('commitment_owner_user').on(table.ownerUserId),
  ],
);

export const scorecardStatuses = ['draft', 'signed'] as const;

/**
 * JBP-07: Scorecard des Gemeinsamen Plans, geteilt. Status und Version ändert für beide Seiten
 * app_scorecard_transition (Migration 0049): signed erst mit beiden Unterschriften derselben Version.
 */
export const scorecard = pgTable(
  'scorecard',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('shared'),
    jbpId: uuid()
      .notNull()
      .references(() => jbp.id, { onDelete: 'cascade' }),
    version: integer().notNull().default(1),
    status: text({ enum: scorecardStatuses }).notNull().default('draft'),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    check('scorecard_status', sql`${table.status} in ('draft', 'signed')`),
    check('scorecard_version', sql`${table.version} > 0`),
    index('scorecard_jbp').on(table.jbpId),
  ],
);

/** Kennzahl der Scorecard; jede Seite schlägt ihre eigenen vor und bearbeitet nur diese. */
export const scorecardKpi = pgTable(
  'scorecard_kpi',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('shared'),
    scorecardId: uuid()
      .notNull()
      .references(() => scorecard.id, { onDelete: 'cascade' }),
    initiativeId: uuid().references(() => initiative.id, { onDelete: 'set null' }),
    name: text().notNull(),
    unit: text().notNull(),
    direction: text({ enum: ['higher', 'lower'] }).notNull(),
    // Dezimalzahl, nie Gleitkomma; Geldbeträge stehen als Einheit „EUR“ in ganzen Euro.
    baseline: numeric({ precision: 18, scale: 4 }),
    target: numeric({ precision: 18, scale: 4 }).notNull(),
    targetDate: date().notNull(),
    ownerSide: text({ enum: ['buyer', 'supplier'] }).notNull(),
    ownerUserId: text(),
    ownerName: text().notNull(),
    benefitFor: text({ enum: ['buyer', 'supplier', 'both'] }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    check('scorecard_kpi_direction', sql`${table.direction} in ('higher', 'lower')`),
    check('scorecard_kpi_owner_side', sql`${table.ownerSide} in ('buyer', 'supplier')`),
    check('scorecard_kpi_benefit', sql`${table.benefitFor} in ('buyer', 'supplier', 'both')`),
    check('scorecard_kpi_name', sql`length(trim(${table.name})) between 1 and 120`),
    check('scorecard_kpi_unit', sql`length(trim(${table.unit})) between 1 and 30`),
    check('scorecard_kpi_owner', sql`length(trim(${table.ownerName})) between 1 and 200`),
    index('scorecard_kpi_scorecard').on(table.scorecardId),
  ],
);

/** Unterschrift einer Seite unter eine Version der Scorecard, geteilt und nur anfügbar. */
export const scorecardSignature = pgTable(
  'scorecard_signature',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('shared'),
    scorecardId: uuid()
      .notNull()
      .references(() => scorecard.id, { onDelete: 'cascade' }),
    version: integer().notNull(),
    side: text({ enum: ['buyer', 'supplier'] }).notNull(),
    userId: text().notNull(),
    userName: text().notNull(),
    signedAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    check('scorecard_signature_side', sql`${table.side} in ('buyer', 'supplier')`),
    index('scorecard_signature_scorecard').on(table.scorecardId, table.version),
  ],
);

/**
 * JBP-09: Ist-Wert einer Kennzahl je Monat, geteilt. Erfasst nur die verantwortliche Seite der
 * Kennzahl (owner_org_id wie bei der Kennzahl); je Kennzahl und Monat ein Wert, ein neuer ersetzt.
 */
export const kpiValue = pgTable(
  'kpi_value',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    ownerOrgId: uuid()
      .notNull()
      .references(() => organization.id),
    visibility: text({ enum: ['internal', 'shared'] })
      .notNull()
      .default('shared'),
    kpiId: uuid()
      .notNull()
      .references(() => scorecardKpi.id, { onDelete: 'cascade' }),
    /** Erster Tag des Monats */
    period: date().notNull(),
    value: numeric({ precision: 18, scale: 4 }).notNull(),
    source: text({ enum: ['manual', 'csv'] }).notNull(),
    enteredBy: text().notNull(),
    enteredByName: text().notNull(),
    enteredAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
    // ZA-01: Herkunft und Bestätigung
    ...originColumns(),
    ...confirmColumns(),
  },
  (table) => [
    originConstraint('kpi_value', table.origin),
    confirmConstraint('kpi_value', table.confirmState),
    check('kpi_value_source', sql`${table.source} in ('manual', 'csv')`),
    check('kpi_value_period', sql`extract(day from ${table.period}) = 1`),
    index('kpi_value_kpi').on(table.kpiId, table.period),
  ],
);

/** JBP-09: Einstellung des Kunden, ab wann eine Kennzahl „knapp“ statt „nicht auf Kurs“ ist. */
export const scorecardSetting = pgTable(
  'scorecard_setting',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    tolerancePercent: integer().notNull().default(10),
    updatedAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    check('scorecard_setting_tolerance', sql`${table.tolerancePercent} between 0 and 50`),
  ],
);
