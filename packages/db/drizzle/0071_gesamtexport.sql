CREATE TABLE "data_export" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"requested_by" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"customer_org_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"file_name" text,
	"file" "bytea",
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "data_export_status" CHECK ("data_export"."status" in ('pending', 'running', 'done', 'failed')),
	CONSTRAINT "data_export_file" CHECK (("data_export"."status" = 'done') = ("data_export"."file" is not null and "data_export"."expires_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "outbox_event" DROP CONSTRAINT "outbox_event_email_payload";--> statement-breakpoint
ALTER TABLE "data_export" ADD CONSTRAINT "data_export_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_export_org" ON "data_export" USING btree ("org_id","created_at");--> statement-breakpoint
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
            'mention', 'export_ready'
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
SELECT app_apply_layer('data_export', 'org_private');
