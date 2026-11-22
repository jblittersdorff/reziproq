import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { organization } from './organization.js';
import { relationship } from './relationship.js';

// QBR-03: Maßnahmen einer Beziehung. Geteilt oder intern (visibility); jede Seite bearbeitet nur
// ihre eigenen Zeilen (PLT-04). Den Status geteilter Maßnahmen ändern beide Seiten über die
// Funktion app_massnahme_status. Personen stehen als ID und Name ohne Fremdschlüssel auf app_user.

export const actionStatuses = ['open', 'in_progress', 'done', 'cancelled'] as const;
export const actionSourceTypes = ['meeting', 'feedback_gap', 'initiative', 'manual'] as const;

export const action = pgTable(
  'action',
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
    title: text().notNull(),
    description: text(),
    ownerSide: text({ enum: ['buyer', 'supplier'] }).notNull(),
    ownerUserId: text(),
    ownerName: text().notNull(),
    dueDate: date().notNull(),
    status: text({ enum: actionStatuses }).notNull().default('open'),
    // Genau eine Quelle: manual ohne ID, alle anderen mit (Prüfung unten).
    sourceType: text({ enum: actionSourceTypes }).notNull(),
    sourceId: uuid(),
    doneAt: timestamp({ withTimezone: true }),
    createdBy: text().notNull(),
    createdByName: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('action_status', sql`${table.status} in ('open', 'in_progress', 'done', 'cancelled')`),
    check('action_owner_side', sql`${table.ownerSide} in ('buyer', 'supplier')`),
    check(
      'action_source_type',
      sql`${table.sourceType} in ('meeting', 'feedback_gap', 'initiative', 'manual')`,
    ),
    check('action_one_source', sql`(${table.sourceType} = 'manual') = (${table.sourceId} is null)`),
    check('action_title', sql`length(trim(${table.title})) between 1 and 200`),
    index('action_relationship').on(table.relationshipId, table.dueDate),
    index('action_owner_user').on(table.ownerUserId),
  ],
);

/** Private Quelle einer Maßnahme, z. B. ein Hinweis (FS-01); nur die eigene Seite sieht sie. */
export const actionPrivateSource = pgTable(
  'action_private_source',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    actionId: uuid()
      .notNull()
      .references(() => action.id, { onDelete: 'cascade' }),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    sourceType: text().notNull(),
    sourceId: uuid().notNull(),
  },
  (table) => [index('action_private_source_action').on(table.actionId)],
);

// QBR-04: Erinnerung und Eskalation. Jede Organisation merkt sich, was sie zu welcher Frist schon
// verschickt hat; eine verschobene Frist löst wieder aus. Nur die eigene Seite sieht es.
export const actionNotificationKinds = ['reminder', 'escalation'] as const;

export const actionNotification = pgTable(
  'action_notification',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    actionId: uuid()
      .notNull()
      .references(() => action.id, { onDelete: 'cascade' }),
    relationshipId: uuid()
      .notNull()
      .references(() => relationship.id),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    kind: text({ enum: actionNotificationKinds }).notNull(),
    dueDate: date().notNull(),
    sentAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('action_notification_kind', sql`${table.kind} in ('reminder', 'escalation')`),
    unique('action_notification_einmal').on(table.orgId, table.actionId, table.kind, table.dueDate),
  ],
);

// QBR-04: Einstellungen je Organisation, für Käufer und Lieferanten. Erster Schlüssel:
// action_reminder_days (Standard 3, im Code).
// PNL-10: fiscal_year_start_month (1 bis 12, Standard 1 = Januar).
// FS-01: hint_max_focus_per_sro (Standard 8, im Code).
export const orgSettingKeys = [
  'action_reminder_days',
  'fiscal_year_start_month',
  'hint_max_focus_per_sro',
  // WG-01: eigene Bezeichnung statt „Warengruppe“ / „Warengruppen“
  'category_label_singular',
  'category_label_plural',
  // AW-01, NAV-10: Jahresziel EBIT gesichert je Geschäftsjahr, { "2026": 60000000 } in Cent
  'goal_ebit_year',
  // KI-01: Einstellungen KI (Startwerte im Code, packages/shared/src/ai-settings.ts)
  'ai_public_research',
  'ai_source_kinds',
  'ai_budget_month_cents',
  'ai_budget_run_cents',
  'ai_max_steps',
  'ai_custom_agent_roles',
  'ai_custom_agent_approval',
  'ai_agent_budget_overrides',
  // KI-11: Segmente für den monatlichen Lauf des Wertpotenzial-Finders
  'ai_value_finder_segments',
  // KI-11: eigene Annahmen der Hebel-Vorlagen
  'ai_value_assumptions',
] as const;

export const orgSetting = pgTable(
  'org_setting',
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    orgId: uuid()
      .notNull()
      .references(() => organization.id),
    key: text({ enum: orgSettingKeys }).notNull(),
    value: jsonb().notNull(),
    updatedBy: text().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'org_setting_key',
      sql`${table.key} in ('action_reminder_days', 'fiscal_year_start_month', 'hint_max_focus_per_sro',
        'category_label_singular', 'category_label_plural', 'goal_ebit_year',
        'ai_public_research', 'ai_source_kinds', 'ai_budget_month_cents', 'ai_budget_run_cents',
        'ai_max_steps', 'ai_custom_agent_roles', 'ai_custom_agent_approval',
        'ai_agent_budget_overrides', 'ai_value_finder_segments', 'ai_value_assumptions')`,
    ),
    unique('org_setting_je_schluessel').on(table.orgId, table.key),
  ],
);
