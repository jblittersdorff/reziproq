import { sql } from 'drizzle-orm';
import { check, date, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
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
    createdBy: text().notNull(),
    createdByName: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('initiative_status', sql`${table.status} in ('planned', 'running', 'done', 'stopped')`),
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
