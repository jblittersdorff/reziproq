CREATE TABLE "filed_mail" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"filed_by" text NOT NULL,
	"visibility" text NOT NULL,
	"message_id" text NOT NULL,
	"from_email" text NOT NULL,
	"from_name" text,
	"to_emails" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"subject" text NOT NULL,
	"body_text" text NOT NULL,
	"summary_draft_id" uuid,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "filed_mail_eindeutig" UNIQUE("org_id","relationship_id","message_id"),
	CONSTRAINT "filed_mail_visibility" CHECK ("filed_mail"."visibility" in ('team', 'private')),
	CONSTRAINT "filed_mail_source" CHECK ("filed_mail"."source" in ('addin', 'forward'))
);
--> statement-breakpoint
CREATE TABLE "filed_mail_attachment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"filed_mail_id" uuid NOT NULL,
	"filed_by" text NOT NULL,
	"visibility" text NOT NULL,
	"file_name" text NOT NULL,
	"mime" text NOT NULL,
	"size" bigint NOT NULL,
	"file_key" text,
	"document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "filed_mail_attachment_visibility" CHECK ("filed_mail_attachment"."visibility" in ('team', 'private'))
);
--> statement-breakpoint
ALTER TABLE "ai_draft" DROP CONSTRAINT "ai_draft_kind";--> statement-breakpoint
ALTER TABLE "filed_mail" ADD CONSTRAINT "filed_mail_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filed_mail" ADD CONSTRAINT "filed_mail_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filed_mail" ADD CONSTRAINT "filed_mail_filed_by_app_user_id_fk" FOREIGN KEY ("filed_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filed_mail_attachment" ADD CONSTRAINT "filed_mail_attachment_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filed_mail_attachment" ADD CONSTRAINT "filed_mail_attachment_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filed_mail_attachment" ADD CONSTRAINT "filed_mail_attachment_filed_mail_id_filed_mail_id_fk" FOREIGN KEY ("filed_mail_id") REFERENCES "public"."filed_mail"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filed_mail_attachment" ADD CONSTRAINT "filed_mail_attachment_filed_by_app_user_id_fk" FOREIGN KEY ("filed_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "filed_mail_relationship" ON "filed_mail" USING btree ("relationship_id","sent_at");--> statement-breakpoint
CREATE INDEX "filed_mail_attachment_mail" ON "filed_mail_attachment" USING btree ("filed_mail_id");--> statement-breakpoint
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_kind" CHECK ("ai_draft"."kind" in ('deviation_explanation', 'feedback_themes', 'plan_summary', 'pre_read', 'market_analysis', 'data_request', 'qbr_topics', 'qbr_risks', 'qbr_open_points', 'hint_explanation', 'brief_situation', 'brief_goals', 'brief_agenda', 'brief_internal_questions', 'brief_supplier_questions', 'brief_expected_questions', 'brief_risks', 'brief_open_points', 'capture_commitment', 'capture_action', 'capture_decision', 'capture_question', 'capture_commitment_change', 'capture_goal_check', 'mail_summary'));--> statement-breakpoint
SELECT app_apply_layer('filed_mail', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('filed_mail_attachment', 'org_private');--> statement-breakpoint
-- IN-04: „Nur ich“ sieht nur, wer die Mail abgelegt hat, auch ihre Anhänge. Ablegen nur als man
-- selbst, löschen nur die eigenen.
CREATE POLICY filed_mail_private_owner ON filed_mail AS RESTRICTIVE FOR ALL TO reziproq_app
USING (visibility = 'team' OR filed_by = app_current_user_id());--> statement-breakpoint
CREATE POLICY filed_mail_insert_self ON filed_mail AS RESTRICTIVE FOR INSERT TO reziproq_app
WITH CHECK (filed_by = app_current_user_id());--> statement-breakpoint
CREATE POLICY filed_mail_delete_owner ON filed_mail AS RESTRICTIVE FOR DELETE TO reziproq_app
USING (filed_by = app_current_user_id());--> statement-breakpoint
CREATE POLICY filed_mail_attachment_private_owner ON filed_mail_attachment AS RESTRICTIVE FOR ALL TO reziproq_app
USING (visibility = 'team' OR filed_by = app_current_user_id());--> statement-breakpoint
CREATE POLICY filed_mail_attachment_insert_self ON filed_mail_attachment AS RESTRICTIVE FOR INSERT TO reziproq_app
WITH CHECK (filed_by = app_current_user_id());
