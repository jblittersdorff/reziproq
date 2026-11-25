ALTER TABLE "org_setting" DROP CONSTRAINT "org_setting_key";--> statement-breakpoint
ALTER TABLE "org_setting" ADD CONSTRAINT "org_setting_key" CHECK ("org_setting"."key" in ('action_reminder_days', 'fiscal_year_start_month', 'hint_max_focus_per_sro',
        'category_label_singular', 'category_label_plural', 'goal_ebit_year',
        'ai_public_research', 'ai_source_kinds', 'ai_budget_month_cents', 'ai_budget_run_cents',
        'ai_max_steps', 'ai_custom_agent_roles', 'ai_custom_agent_approval',
        'ai_agent_budget_overrides', 'ai_value_finder_segments', 'ai_value_assumptions', 'hint_rules', 'hint_thresholds', 'brief_lead_days', 'notify_teams_app', 'notify_mail', 'transcripts_enabled',
        'works_agreement_confirmed_at', 'works_agreement_confirmed_by', 'works_agreement_file_key',
        'transcript_retention_days', 'teams_transcript_mode', 'invite_notice_text', 'award_eligibility', 'category_approval', 'ai_workers'));--> statement-breakpoint
-- MA-01 (K1-f): An oder aus je Aufgabe steht jetzt in den KI-Einstellungen (ai_workers). Der Stand
-- des Termin-Briefings aus der bisherigen Seite Agenten (agent_org_state) wird übernommen; die
-- Tabelle bleibt (E-K0-13).
INSERT INTO "org_setting" ("org_id", "key", "value", "updated_by")
SELECT s."org_id", 'ai_workers', jsonb_build_object('meeting_brief', jsonb_build_object('enabled', bool_or(s."enabled"))), 'system:k1f'
  FROM "agent_org_state" s
  JOIN "agent" a ON a."org_id" = s."org_id" AND a."id" = s."agent_id"
  WHERE a."key" = 'meeting_brief'
  GROUP BY s."org_id"
ON CONFLICT ("org_id", "key") DO NOTHING;
