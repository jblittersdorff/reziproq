ALTER TABLE "ai_draft" DROP CONSTRAINT "ai_draft_kind";--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "review_comment" text;--> statement-breakpoint
ALTER TABLE "agent" ADD COLUMN "paused_reason" text;--> statement-breakpoint
ALTER TABLE "agent_version" ADD COLUMN "test_run_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_version" ADD COLUMN "test_passed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_version" ADD COLUMN "check_status" text;--> statement-breakpoint
ALTER TABLE "agent_version" ADD COLUMN "check_note" text;--> statement-breakpoint
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_kind" CHECK ("ai_draft"."kind" in ('deviation_explanation', 'feedback_themes', 'plan_summary', 'pre_read', 'market_analysis', 'data_request', 'qbr_topics', 'qbr_risks', 'qbr_open_points', 'hint_explanation', 'brief_situation', 'brief_goals', 'brief_agenda', 'brief_internal_questions', 'brief_supplier_questions', 'brief_expected_questions', 'brief_risks', 'brief_open_points', 'capture_commitment', 'capture_action', 'capture_decision', 'capture_question', 'capture_commitment_change', 'capture_goal_check', 'mail_summary', 'agent_result'));