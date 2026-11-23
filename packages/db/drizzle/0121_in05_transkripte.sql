CREATE TABLE "meeting_transcript" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"source" text NOT NULL,
	"external_id" text,
	"language" text,
	"duration_s" integer,
	"speakers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"entries_ref" text,
	"key_ref" text,
	"fetched_at" timestamp with time zone,
	"delete_after" timestamp with time zone,
	"status" text NOT NULL,
	"unavailable_reason" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"released_to_participants" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_transcript_source" CHECK ("meeting_transcript"."source" in ('teams', 'meet', 'upload')),
	CONSTRAINT "meeting_transcript_status" CHECK ("meeting_transcript"."status" in ('pending', 'fetched', 'unavailable', 'deleted'))
);
--> statement-breakpoint
ALTER TABLE "org_setting" DROP CONSTRAINT "org_setting_key";--> statement-breakpoint
ALTER TABLE "meeting_capture" DROP CONSTRAINT "meeting_capture_source";--> statement-breakpoint
ALTER TABLE "meeting_transcript" ADD CONSTRAINT "meeting_transcript_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_transcript" ADD CONSTRAINT "meeting_transcript_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_transcript" ADD CONSTRAINT "meeting_transcript_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_transcript_meeting" ON "meeting_transcript" USING btree ("meeting_id","created_at");--> statement-breakpoint
CREATE INDEX "meeting_transcript_delete" ON "meeting_transcript" USING btree ("status","delete_after");--> statement-breakpoint
ALTER TABLE "org_setting" ADD CONSTRAINT "org_setting_key" CHECK ("org_setting"."key" in ('action_reminder_days', 'fiscal_year_start_month', 'hint_max_focus_per_sro',
        'category_label_singular', 'category_label_plural', 'goal_ebit_year',
        'ai_public_research', 'ai_source_kinds', 'ai_budget_month_cents', 'ai_budget_run_cents',
        'ai_max_steps', 'ai_custom_agent_roles', 'ai_custom_agent_approval',
        'ai_agent_budget_overrides', 'ai_value_finder_segments', 'ai_value_assumptions', 'hint_rules', 'hint_thresholds', 'brief_lead_days', 'notify_teams_app', 'notify_mail', 'transcripts_enabled',
        'works_agreement_confirmed_at', 'works_agreement_confirmed_by', 'works_agreement_file_key',
        'transcript_retention_days', 'teams_transcript_mode', 'invite_notice_text'));--> statement-breakpoint
ALTER TABLE "meeting_capture" ADD CONSTRAINT "meeting_capture_source" CHECK ("meeting_capture"."source" in ('typed', 'pasted', 'file', 'transcript'));--> statement-breakpoint
SELECT app_apply_layer('meeting_transcript', 'org_private');
