ALTER TABLE "org_setting" DROP CONSTRAINT "org_setting_key";--> statement-breakpoint
ALTER TABLE "ai_draft" DROP CONSTRAINT "ai_draft_kind";--> statement-breakpoint
ALTER TABLE "meeting" DROP CONSTRAINT "meeting_type";--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "duration_minutes" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_agenda_item" ADD COLUMN "detail" text;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "input_checksum" text;--> statement-breakpoint
ALTER TABLE "org_setting" ADD CONSTRAINT "org_setting_key" CHECK ("org_setting"."key" in ('action_reminder_days', 'fiscal_year_start_month', 'hint_max_focus_per_sro',
        'category_label_singular', 'category_label_plural', 'goal_ebit_year',
        'ai_public_research', 'ai_source_kinds', 'ai_budget_month_cents', 'ai_budget_run_cents',
        'ai_max_steps', 'ai_custom_agent_roles', 'ai_custom_agent_approval',
        'ai_agent_budget_overrides', 'ai_value_finder_segments', 'ai_value_assumptions', 'hint_rules', 'hint_thresholds', 'brief_lead_days'));--> statement-breakpoint
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_kind" CHECK ("ai_draft"."kind" in ('deviation_explanation', 'feedback_themes', 'plan_summary', 'pre_read', 'market_analysis', 'data_request', 'qbr_topics', 'qbr_risks', 'qbr_open_points', 'hint_explanation', 'brief_situation', 'brief_goals', 'brief_agenda', 'brief_internal_questions', 'brief_supplier_questions', 'brief_expected_questions', 'brief_risks', 'brief_open_points'));--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_duration" CHECK ("meeting"."duration_minutes" between 15 and 600);--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_type" CHECK ("meeting"."type" in ('quarterly_review', 'strategy_dialogue', 'jbp', 'negotiation', 'site_visit', 'escalation', 'format', 'other'));--> statement-breakpoint
-- KI-07: Der Agent „QBR-Vorbereitung“ heißt jetzt „Termin-Briefing“. Läufe und Entwürfe bleiben.
UPDATE "agent" SET "key" = 'meeting_brief', "name" = 'Termin-Briefing',
  "description" = 'Bereitet wichtige Termine mit einem Lieferanten vor: Lage, Ziele, Agenda, Fragen, Risiken, offene Punkte.'
  WHERE "key" = 'qbr_prep';
