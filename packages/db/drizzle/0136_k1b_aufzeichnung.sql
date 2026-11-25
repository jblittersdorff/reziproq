CREATE TABLE "model_call_recording" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"feature" text NOT NULL,
	"input_hash" text NOT NULL,
	"response" jsonb NOT NULL,
	"model_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	CONSTRAINT "model_call_recording_eingabe" UNIQUE("org_id","feature","input_hash")
);
--> statement-breakpoint
ALTER TABLE "model_call_recording" ADD CONSTRAINT "model_call_recording_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- DM-01, KI-01 (K1-b.1): Aufzeichnungen gibt es nur im Demo-Mandanten. Zusätzlich zur Ebene
-- org_private lässt die Policy Lesen und Schreiben nur für Organisationen mit is_demo zu.
CREATE FUNCTION app_org_is_demo(p_org uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT coalesce((SELECT o.is_demo FROM organization o WHERE o.id = p_org), false)
  $$;--> statement-breakpoint
ALTER FUNCTION app_org_is_demo(uuid) OWNER TO reziproq_stammdaten;--> statement-breakpoint
SELECT app_apply_layer('model_call_recording', 'org_private');--> statement-breakpoint
CREATE POLICY model_call_recording_demo ON model_call_recording AS RESTRICTIVE FOR ALL TO reziproq_app
  USING (app_org_is_demo(org_id)) WITH CHECK (app_org_is_demo(org_id));
