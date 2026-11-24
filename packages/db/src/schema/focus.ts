import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { appUser } from './app-user.js';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// HE-01: Jedes Ergebnis (Hinweis, Entwurf, Lauf, Frist, Freigabe) erzeugt genau ein Fokus-Thema
// für eine Person. level: focus (Entscheidung, Freigabe, Gespräch), review (Entwurf in Kurz
// prüfen), done (Handlung auf Erledigen). Nur die Person selbst sieht ihre Zeilen (Policy in der
// Migration). source_type und source_id halten fest, aus welchem Ergebnis die Zeile entstand, damit
// die Triage es nicht doppelt anlegt; das ergänzt die Spalten der Spec.
export const focusLevels = ['focus', 'review', 'done'] as const;
export type FocusLevel = (typeof focusLevels)[number];
export const focusKinds = ['decision', 'approval', 'conversation', 'draft', 'info'] as const;
export type FocusKind = (typeof focusKinds)[number];
export const focusStates = ['open', 'decided', 'snoozed', 'dismissed'] as const;
export type FocusState = (typeof focusStates)[number];

/** Zahl in einem Satz von Reziproq mit Herkunft (G-6): nur diese Zahlen dürfen im Satz stehen. */
export interface SentenceFact {
  key: string;
  value: number | string;
  unit?: string | undefined;
  source: { objectType: string; objectId?: string | undefined; label: string };
}

export const focusItem = pgTable(
  'focus_item',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    level: text({ enum: focusLevels }).notNull(),
    kind: text({ enum: focusKinds }).notNull(),
    title: text().notNull(),
    sentence: text(),
    sentenceFacts: jsonb().$type<SentenceFact[]>().notNull().default([]),
    objectType: text().notNull(),
    objectId: uuid(),
    relationshipId: uuid().references(() => relationship.id, { onDelete: 'cascade' }),
    sourceType: text().notNull(),
    sourceId: uuid().notNull(),
    /** Punktzahl der Triage: Wirkung × Dringlichkeit × Segmentgewicht (HE-01, K1-c) */
    score: bigint({ mode: 'number' }).notNull().default(0),
    dueAt: timestamp({ withTimezone: true }),
    /** Ort der Erledigung in der App (K1-c); die Fokus-Mappe kommt mit K1-e */
    href: text(),
    snoozedUntil: timestamp({ withTimezone: true }),
    state: text({ enum: focusStates }).notNull().default('open'),
    runId: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    check('focus_item_level', sql`${table.level} in ('focus', 'review', 'done')`),
    check(
      'focus_item_kind',
      sql`${table.kind} in ('decision', 'approval', 'conversation', 'draft', 'info')`,
    ),
    check('focus_item_state', sql`${table.state} in ('open', 'decided', 'snoozed', 'dismissed')`),
    check('focus_item_title', sql`length(trim(${table.title})) between 1 and 300`),
    check('focus_item_facts', sql`jsonb_typeof(${table.sentenceFacts}) = 'array'`),
    check('focus_item_href', sql`${table.href} is null or left(${table.href}, 1) = '/'`),
    unique('focus_item_quelle').on(table.orgId, table.userId, table.sourceType, table.sourceId),
    index('focus_item_person').on(table.orgId, table.userId, table.level, table.state),
  ],
);

// MA-01: Stufe je Person und Aufgabe von Reziproq. Ohne Zeile gilt die Startstufe der Aufgabe aus
// der Registry (packages/shared/src/workers.ts). Nur die Person selbst sieht und ändert ihre Zeilen.

// Gleich mit workerLevels in packages/shared/src/workers.ts (geprüft in workers.test.ts der API);
// das Schema importiert nichts aus @reziproq/shared, weil drizzle-kit es ohne Quell-Auflösung lädt.
export const workerLevels = ['suggest', 'prepare', 'do'] as const;

export const workerSetting = pgTable(
  'worker_setting',
  {
    orgId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    agentKey: text().notNull(),
    level: text({ enum: workerLevels }).notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    primaryKey({ columns: [table.orgId, table.userId, table.agentKey] }),
    check('worker_setting_level', sql`${table.level} in ('suggest', 'prepare', 'do')`),
  ],
);

// ZA-01 Regel 3, MA-01 Leitplanken: Bestätigungs-Token eines Menschen für eine bindende Handlung
// an genau einem Objekt. Ein Lauf bringt ein Objekt nur mit einem gültigen, ungenutzten Token in
// die Mitte (Trigger app_guard_shared). Das Token gehört der Person, die bestätigt hat.
export const confirmToken = pgTable(
  'confirm_token',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    purpose: text().notNull(),
    objectType: text().notNull(),
    objectId: uuid().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    check('confirm_token_frist', sql`${table.expiresAt} > ${table.createdAt}`),
    index('confirm_token_objekt').on(table.orgId, table.objectType, table.objectId),
  ],
);
