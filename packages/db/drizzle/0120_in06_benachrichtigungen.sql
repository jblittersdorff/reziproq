CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"channel" text NOT NULL,
	"kind" text NOT NULL,
	"object_type" text NOT NULL,
	"object_id" text NOT NULL,
	"bundle_key" text NOT NULL,
	"delivery" text NOT NULL,
	"status" text NOT NULL,
	"title" text NOT NULL,
	"line" text,
	"href" text NOT NULL,
	"message_ref" text,
	"reason" text,
	"sent_at" timestamp with time zone,
	"action_taken" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_channel" CHECK ("notification"."channel" in ('teams', 'mail')),
	CONSTRAINT "notification_delivery" CHECK ("notification"."delivery" in ('now', 'digest')),
	CONSTRAINT "notification_status" CHECK ("notification"."status" in ('queued', 'sent', 'failed', 'suppressed'))
);
--> statement-breakpoint
CREATE TABLE "notification_channel" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"channel" text NOT NULL,
	"conversation_ref" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_channel_eindeutig" UNIQUE("user_id","channel")
);
--> statement-breakpoint
CREATE TABLE "notification_pref" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"channel" text NOT NULL,
	"kind" text NOT NULL,
	"mode" text NOT NULL,
	"quiet_hours" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_pref_eindeutig" UNIQUE("user_id","channel","kind"),
	CONSTRAINT "notification_pref_channel" CHECK ("notification_pref"."channel" in ('teams', 'mail')),
	CONSTRAINT "notification_pref_mode" CHECK ("notification_pref"."mode" in ('now', 'digest', 'off'))
);
--> statement-breakpoint
ALTER TABLE "org_setting" DROP CONSTRAINT "org_setting_key";--> statement-breakpoint
ALTER TABLE "outbox_event" DROP CONSTRAINT "outbox_event_email_payload";--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_channel" ADD CONSTRAINT "notification_channel_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_channel" ADD CONSTRAINT "notification_channel_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_pref" ADD CONSTRAINT "notification_pref_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_pref" ADD CONSTRAINT "notification_pref_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_user" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_bundle" ON "notification" USING btree ("bundle_key","created_at");--> statement-breakpoint
ALTER TABLE "org_setting" ADD CONSTRAINT "org_setting_key" CHECK ("org_setting"."key" in ('action_reminder_days', 'fiscal_year_start_month', 'hint_max_focus_per_sro',
        'category_label_singular', 'category_label_plural', 'goal_ebit_year',
        'ai_public_research', 'ai_source_kinds', 'ai_budget_month_cents', 'ai_budget_run_cents',
        'ai_max_steps', 'ai_custom_agent_roles', 'ai_custom_agent_approval',
        'ai_agent_budget_overrides', 'ai_value_finder_segments', 'ai_value_assumptions', 'hint_rules', 'hint_thresholds', 'brief_lead_days', 'notify_teams_app', 'notify_mail'));--> statement-breakpoint
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_email_payload" CHECK ((
        ("outbox_event"."email_template" IS NULL AND "outbox_event"."email_locale" IS NULL
          AND "outbox_event"."email_recipient" IS NULL AND "outbox_event"."email_first_name" IS NULL
          AND "outbox_event"."email_title" IS NULL AND "outbox_event"."email_deadline" IS NULL
          AND "outbox_event"."email_link" IS NULL AND "outbox_event"."email_sender" IS NULL
          AND "outbox_event"."email_message" IS NULL)
        OR
        ("outbox_event"."email_template" IS NOT NULL
          AND "outbox_event"."email_template" IN (
            'invitation', 'reminder', 'approval', 'escalation', 'supplier_invitation', 'survey',
            'mention', 'export_ready', 'notification', 'digest'
          )
          AND "outbox_event"."email_locale" IS NOT NULL
          AND "outbox_event"."email_locale" IN ('de', 'en')
          AND "outbox_event"."email_recipient" IS NOT NULL
          AND length(trim("outbox_event"."email_recipient")) > 0
          AND "outbox_event"."email_title" IS NOT NULL
          AND length(trim("outbox_event"."email_title")) > 0
          AND "outbox_event"."email_link" IS NOT NULL
          AND "outbox_event"."email_link" LIKE '/%'
          AND "outbox_event"."email_link" NOT LIKE '//%'
          AND position('?' in "outbox_event"."email_link") = 0
          AND position('#' in "outbox_event"."email_link") = 0
          AND position(chr(92) in "outbox_event"."email_link") = 0)
      ));--> statement-breakpoint
SELECT app_apply_layer('notification_pref', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('notification_channel', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('notification', 'org_private');--> statement-breakpoint
-- IN-06: Einstellungen und Teams-Verbindung liest und ändert nur die Person selbst.
CREATE POLICY notification_pref_self ON notification_pref AS RESTRICTIVE FOR ALL TO reziproq_app
USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());--> statement-breakpoint
CREATE POLICY notification_channel_self ON notification_channel AS RESTRICTIVE FOR ALL TO reziproq_app
USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
