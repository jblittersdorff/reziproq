import { sql } from 'drizzle-orm';
import { check, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { organization } from './organization.js';

// Früher in action.ts; die Maßnahmen selbst sind mit ZQ-01 (K2-a.3) zu Zusagen und Aufgaben
// geworden (initiative.ts, task.ts).

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
  // KI-16: Regeln an oder aus, Schwellen je Regel
  'hint_rules',
  'hint_thresholds',
  // KI-07: Vorlauf des Termin-Briefings je Termintyp in Tagen
  'brief_lead_days',
  // IN-06: Teams-App für die Organisation freigeschaltet, Mailversand für Benachrichtigungen an
  'notify_teams_app',
  'notify_mail',
  // IN-05: Transkripte nur mit bestätigter Betriebsvereinbarung
  'transcripts_enabled',
  'works_agreement_confirmed_at',
  'works_agreement_confirmed_by',
  'works_agreement_file_key',
  'transcript_retention_days',
  'teams_transcript_mode',
  'invite_notice_text',
  // WG-14: Bedingungen für Vergabefähigkeit, { qualityNotCritical, stabilityNotCritical }
  'award_eligibility',
  // WG-16: Freigabeweg, { relevanceThreshold, spendThresholdCents, routes: { board, head, tandem, department } }
  'category_approval',
  // MA-01 (K1-f): Aufgaben von Reziproq an oder aus und Obergrenze je Aufgabe, { [key]: { enabled, cap } }
  'ai_workers',
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
    updatedAt: timestamp({ withTimezone: true }).notNull().default(sql`app_now()`),
  },
  (table) => [
    check(
      'org_setting_key',
      sql`${table.key} in ('action_reminder_days', 'fiscal_year_start_month', 'hint_max_focus_per_sro',
        'category_label_singular', 'category_label_plural', 'goal_ebit_year',
        'ai_public_research', 'ai_source_kinds', 'ai_budget_month_cents', 'ai_budget_run_cents',
        'ai_max_steps', 'ai_custom_agent_roles', 'ai_custom_agent_approval',
        'ai_agent_budget_overrides', 'ai_value_finder_segments', 'ai_value_assumptions', 'hint_rules', 'hint_thresholds', 'brief_lead_days', 'notify_teams_app', 'notify_mail', 'transcripts_enabled',
        'works_agreement_confirmed_at', 'works_agreement_confirmed_by', 'works_agreement_file_key',
        'transcript_retention_days', 'teams_transcript_mode', 'invite_notice_text', 'award_eligibility', 'category_approval', 'ai_workers')`,
    ),
    unique('org_setting_je_schluessel').on(table.orgId, table.key),
  ],
);
