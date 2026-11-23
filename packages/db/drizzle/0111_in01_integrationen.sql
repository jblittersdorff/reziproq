CREATE TABLE "connection" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"connector_key" text NOT NULL,
	"scope" text NOT NULL,
	"user_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"parts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"connected_by" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "connection_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "connection_scope" CHECK (("connection"."scope" = 'user') = ("connection"."user_id" is not null)),
	CONSTRAINT "connection_status" CHECK ("connection"."status" in ('pending', 'active', 'error', 'revoked'))
);
--> statement-breakpoint
CREATE TABLE "connection_secret" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"ciphertext" text NOT NULL,
	"key_ref" text NOT NULL,
	"expires_at" timestamp with time zone,
	"rotated_at" timestamp with time zone,
	CONSTRAINT "connection_secret_kind" CHECK ("connection_secret"."kind" in ('oauth', 'api_key', 'webhook_secret'))
);
--> statement-breakpoint
CREATE TABLE "inbound_hook" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"path_token" text NOT NULL,
	"secret_ref" uuid NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "inbound_hook_token" UNIQUE("path_token")
);
--> statement-breakpoint
CREATE TABLE "sync_event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"job_id" uuid,
	"direction" text NOT NULL,
	"kind" text NOT NULL,
	"external_id" text,
	"object_type" text,
	"object_id" uuid,
	"status" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_event_direction" CHECK ("sync_event"."direction" in ('in', 'out')),
	CONSTRAINT "sync_event_status" CHECK ("sync_event"."status" in ('applied', 'ignored', 'rejected', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "sync_job" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"items_in" integer DEFAULT 0 NOT NULL,
	"items_ok" integer DEFAULT 0 NOT NULL,
	"items_failed" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_job_status" CHECK ("sync_job"."status" in ('queued', 'running', 'done', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "connection" ADD CONSTRAINT "connection_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_secret" ADD CONSTRAINT "connection_secret_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connection_secret" ADD CONSTRAINT "connection_secret_connection_id_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_hook" ADD CONSTRAINT "inbound_hook_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_hook" ADD CONSTRAINT "inbound_hook_connection_id_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_event" ADD CONSTRAINT "sync_event_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_event" ADD CONSTRAINT "sync_event_connection_id_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_job" ADD CONSTRAINT "sync_job_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_job" ADD CONSTRAINT "sync_job_connection_id_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "connection_org" ON "connection" USING btree ("org_id","connector_key");--> statement-breakpoint
CREATE INDEX "connection_secret_connection" ON "connection_secret" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_event_applied_once" ON "sync_event" USING btree ("connection_id","kind","external_id") WHERE "sync_event"."status" = 'applied';--> statement-breakpoint
CREATE INDEX "sync_event_org_time" ON "sync_event" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "sync_job_connection" ON "sync_job" USING btree ("connection_id","created_at");--> statement-breakpoint
SELECT app_apply_layer('connection', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('connection_secret', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('sync_job', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('sync_event', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('inbound_hook', 'org_private');--> statement-breakpoint

-- IN-01: Ein eingehender Webhook kennt nur sein Pfad-Token. Die Funktion nennt dazu nur Organisation
-- und Verbindung, keine Inhalte; sie läuft als eigene enge Rolle, die nur diese Spalten lesen darf.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'reziproq_hook_lookup') THEN
    CREATE ROLE reziproq_hook_lookup NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint
GRANT reziproq_hook_lookup TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_hook_lookup;--> statement-breakpoint
GRANT SELECT ("org_id", "connection_id", "path_token") ON "inbound_hook" TO reziproq_hook_lookup;--> statement-breakpoint
CREATE POLICY inbound_hook_lookup ON "inbound_hook" FOR SELECT TO reziproq_hook_lookup USING (true);--> statement-breakpoint
CREATE FUNCTION app_inbound_hook(p_token text)
  RETURNS TABLE (org_id uuid, connection_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
  SELECT h.org_id, h.connection_id FROM inbound_hook h WHERE h.path_token = p_token
$$;--> statement-breakpoint
ALTER FUNCTION app_inbound_hook(text) OWNER TO reziproq_hook_lookup;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_inbound_hook(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_inbound_hook(text) TO reziproq_app;
