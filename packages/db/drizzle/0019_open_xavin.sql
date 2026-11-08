CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"outbox_event_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"template" text NOT NULL,
	"status" text NOT NULL,
	"recipient_hash" text NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	CONSTRAINT "email_log_outboxEventId_unique" UNIQUE("outbox_event_id"),
	CONSTRAINT "email_log_status" CHECK ("email_log"."status" in ('sending', 'sent', 'failed')),
	CONSTRAINT "email_log_attempt_count" CHECK ("email_log"."attempt_count" > 0)
);
--> statement-breakpoint
ALTER TABLE "outbox_event" ADD COLUMN "email_template" text;--> statement-breakpoint
ALTER TABLE "outbox_event" ADD COLUMN "email_locale" text;--> statement-breakpoint
ALTER TABLE "outbox_event" ADD COLUMN "email_recipient" text;--> statement-breakpoint
ALTER TABLE "outbox_event" ADD COLUMN "email_first_name" text;--> statement-breakpoint
ALTER TABLE "outbox_event" ADD COLUMN "email_title" text;--> statement-breakpoint
ALTER TABLE "outbox_event" ADD COLUMN "email_deadline" text;--> statement-breakpoint
ALTER TABLE "outbox_event" ADD COLUMN "email_link" text;--> statement-breakpoint
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_email_payload" CHECK ((
        ("outbox_event"."email_template" IS NULL AND "outbox_event"."email_locale" IS NULL
          AND "outbox_event"."email_recipient" IS NULL AND "outbox_event"."email_first_name" IS NULL
          AND "outbox_event"."email_title" IS NULL AND "outbox_event"."email_deadline" IS NULL
          AND "outbox_event"."email_link" IS NULL)
        OR
        ("outbox_event"."email_template" IN ('invitation', 'reminder', 'approval', 'escalation')
          AND "outbox_event"."email_locale" IN ('de', 'en')
          AND length(trim("outbox_event"."email_recipient")) > 0
          AND length(trim("outbox_event"."email_title")) > 0
          AND "outbox_event"."email_link" LIKE '/%'
          AND "outbox_event"."email_link" NOT LIKE '//%'
          AND position('?' in "outbox_event"."email_link") = 0
          AND position('#' in "outbox_event"."email_link") = 0
          AND position(chr(92) in "outbox_event"."email_link") = 0)
      ));--> statement-breakpoint

-- QS-01: Hintergrundjobs erhalten eine eigene, RLS-gebundene Betriebsrolle.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reziproq_jobs') THEN
    CREATE ROLE reziproq_jobs NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO reziproq_jobs', current_database());
END
$$;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_jobs;--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS pgboss AUTHORIZATION reziproq_jobs;--> statement-breakpoint
ALTER SCHEMA pgboss OWNER TO reziproq_jobs;--> statement-breakpoint
GRANT USAGE, CREATE ON SCHEMA pgboss TO reziproq_jobs;--> statement-breakpoint

GRANT SELECT, UPDATE ON outbox_event TO reziproq_jobs;--> statement-breakpoint
CREATE POLICY outbox_event_jobs_read ON outbox_event
  FOR SELECT TO reziproq_jobs USING (true);--> statement-breakpoint
CREATE POLICY outbox_event_jobs_update ON outbox_event
  FOR UPDATE TO reziproq_jobs USING (true) WITH CHECK (true);--> statement-breakpoint

SELECT app_apply_layer('email_log', 'global');--> statement-breakpoint
REVOKE ALL ON email_log FROM reziproq_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON email_log TO reziproq_jobs;--> statement-breakpoint
CREATE POLICY email_log_jobs_access ON email_log
  FOR ALL TO reziproq_jobs USING (true) WITH CHECK (true);