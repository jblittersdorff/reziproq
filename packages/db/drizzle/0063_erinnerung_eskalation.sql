CREATE TABLE "action_notification" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"action_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"due_date" date NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_notification_einmal" UNIQUE("org_id","action_id","kind","due_date"),
	CONSTRAINT "action_notification_kind" CHECK ("action_notification"."kind" in ('reminder', 'escalation'))
);
--> statement-breakpoint
CREATE TABLE "org_setting" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_setting_je_schluessel" UNIQUE("org_id","key"),
	CONSTRAINT "org_setting_key" CHECK ("org_setting"."key" in ('action_reminder_days'))
);
--> statement-breakpoint
ALTER TABLE "action_notification" ADD CONSTRAINT "action_notification_action_id_action_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."action"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_notification" ADD CONSTRAINT "action_notification_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_notification" ADD CONSTRAINT "action_notification_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_setting" ADD CONSTRAINT "org_setting_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
SELECT app_apply_layer('action_notification', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('org_setting', 'org_private');--> statement-breakpoint
-- Was verschickt ist, bleibt verschickt.
REVOKE UPDATE, DELETE ON "action_notification" FROM reziproq_app;--> statement-breakpoint
-- QBR-04: Der tägliche Job muss wissen, für welche Organisationen er eine Mandanten-Session
-- öffnet. app_action_due_orgs nennt nur Organisations-IDs (Käufer ohne, Lieferant mit Kunde) von
-- aktiven Beziehungen mit offenen Maßnahmen, deren Frist im Fenster liegt; keine Inhalte.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'reziproq_action_jobs') THEN
    CREATE ROLE reziproq_action_jobs NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint
GRANT reziproq_action_jobs TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_action_jobs;--> statement-breakpoint
GRANT SELECT ("relationship_id", "status", "due_date") ON "action" TO reziproq_action_jobs;--> statement-breakpoint
CREATE POLICY action_due_orgs ON "action" FOR SELECT TO reziproq_action_jobs USING (true);--> statement-breakpoint
GRANT SELECT ("id", "buyer_org_id", "supplier_org_id", "status") ON "relationship" TO reziproq_action_jobs;--> statement-breakpoint
CREATE POLICY relationship_due_orgs ON "relationship" FOR SELECT TO reziproq_action_jobs USING (true);--> statement-breakpoint
CREATE FUNCTION app_action_due_orgs(p_from date, p_to date)
  RETURNS TABLE (org_id uuid, customer_org_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
  WITH due AS (
    SELECT DISTINCT r.buyer_org_id, r.supplier_org_id
    FROM action a JOIN relationship r ON r.id = a.relationship_id
    WHERE a.status IN ('open', 'in_progress') AND r.status = 'active'
      AND a.due_date BETWEEN p_from AND p_to
  )
  SELECT buyer_org_id, NULL::uuid FROM due
  UNION
  SELECT supplier_org_id, buyer_org_id FROM due
  ORDER BY 1, 2
$$;--> statement-breakpoint
ALTER FUNCTION app_action_due_orgs(date, date) OWNER TO reziproq_action_jobs;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_action_due_orgs(date, date) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_action_due_orgs(date, date) TO reziproq_api;
