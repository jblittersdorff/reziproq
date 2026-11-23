CREATE TABLE "meeting_capture" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"source" text NOT NULL,
	"text" text NOT NULL,
	"file_key" text,
	"run_id" uuid,
	"created_by" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"protocol_shared_at" timestamp with time zone,
	CONSTRAINT "meeting_capture_source" CHECK ("meeting_capture"."source" in ('typed', 'pasted', 'file')),
	CONSTRAINT "meeting_capture_text" CHECK (length("meeting_capture"."text") between 1 and 200000)
);
--> statement-breakpoint
ALTER TABLE "ai_draft" DROP CONSTRAINT "ai_draft_kind";--> statement-breakpoint
ALTER TABLE "meeting_capture" ADD CONSTRAINT "meeting_capture_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_capture" ADD CONSTRAINT "meeting_capture_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_capture" ADD CONSTRAINT "meeting_capture_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_capture_meeting" ON "meeting_capture" USING btree ("org_id","meeting_id","created_at");--> statement-breakpoint
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_kind" CHECK ("ai_draft"."kind" in ('deviation_explanation', 'feedback_themes', 'plan_summary', 'pre_read', 'market_analysis', 'data_request', 'qbr_topics', 'qbr_risks', 'qbr_open_points', 'hint_explanation', 'brief_situation', 'brief_goals', 'brief_agenda', 'brief_internal_questions', 'brief_supplier_questions', 'brief_expected_questions', 'brief_risks', 'brief_open_points', 'capture_commitment', 'capture_action', 'capture_decision', 'capture_question', 'capture_commitment_change', 'capture_goal_check'));--> statement-breakpoint
SELECT app_apply_layer('meeting_capture', 'org_private');
