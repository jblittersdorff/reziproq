ALTER TABLE "org_setting" DROP CONSTRAINT "org_setting_key";--> statement-breakpoint
ALTER TABLE "ai_draft" DROP CONSTRAINT "ai_draft_kind";--> statement-breakpoint
ALTER TABLE "hint" DROP CONSTRAINT "hint_rule_key";--> statement-breakpoint
ALTER TABLE "hint" DROP CONSTRAINT "hint_status";--> statement-breakpoint
ALTER TABLE "hint" ADD COLUMN "rule_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "hint" ADD COLUMN "severity" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "hint" ADD COLUMN "score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hint" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "hint" ADD COLUMN "evidence" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "hint" ADD COLUMN "explanation_draft_id" uuid;--> statement-breakpoint
ALTER TABLE "hint" ADD COLUMN "suggested_action" text;--> statement-breakpoint
ALTER TABLE "hint" ADD COLUMN "feedback" text;--> statement-breakpoint
ALTER TABLE "hint" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "hint" ADD COLUMN "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "hint" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "hint" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hint" ADD COLUMN "resolved_reason" text;--> statement-breakpoint
ALTER TABLE "org_setting" ADD CONSTRAINT "org_setting_key" CHECK ("org_setting"."key" in ('action_reminder_days', 'fiscal_year_start_month', 'hint_max_focus_per_sro',
        'category_label_singular', 'category_label_plural', 'goal_ebit_year',
        'ai_public_research', 'ai_source_kinds', 'ai_budget_month_cents', 'ai_budget_run_cents',
        'ai_max_steps', 'ai_custom_agent_roles', 'ai_custom_agent_approval',
        'ai_agent_budget_overrides', 'ai_value_finder_segments', 'ai_value_assumptions', 'hint_rules', 'hint_thresholds'));--> statement-breakpoint
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_kind" CHECK ("ai_draft"."kind" in ('deviation_explanation', 'feedback_themes', 'plan_summary', 'pre_read', 'market_analysis', 'data_request', 'qbr_topics', 'qbr_risks', 'qbr_open_points', 'hint_explanation'));--> statement-breakpoint
ALTER TABLE "hint" ADD CONSTRAINT "hint_severity" CHECK ("hint"."severity" in ('high', 'medium', 'low'));--> statement-breakpoint
ALTER TABLE "hint" ADD CONSTRAINT "hint_feedback" CHECK ("hint"."feedback" is null or "hint"."feedback" in ('helpful', 'not_helpful'));--> statement-breakpoint
ALTER TABLE "hint" ADD CONSTRAINT "hint_rule_key" CHECK ("hint"."rule_key" in ('segment_spend_only', 'weak_focus', 'unexplained_deviation',
        'too_many_focus', 'no_operational_function', 'cadence_missed', 'no_feedback',
        'plan_missing', 'right_without_obligation', 'buyer_commitments_overdue',
        'performance_drop', 'supplier_commitment_overdue', 'dependency', 'feedback_drop',
        'public_event'));--> statement-breakpoint
ALTER TABLE "hint" ADD CONSTRAINT "hint_status" CHECK ("hint"."status" in ('open', 'in_progress', 'accepted', 'dismissed', 'resolved'));