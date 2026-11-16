CREATE TABLE "hint" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"relationship_id" uuid,
	"rule_key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	CONSTRAINT "hint_rule_key" CHECK ("hint"."rule_key" in ('segment_spend_only', 'weak_focus', 'unexplained_deviation',
        'too_many_focus', 'no_operational_function', 'cadence_missed', 'no_feedback',
        'plan_missing', 'right_without_obligation', 'buyer_commitments_overdue')),
	CONSTRAINT "hint_status" CHECK ("hint"."status" in ('open', 'accepted', 'dismissed')),
	CONSTRAINT "hint_reason" CHECK ("hint"."status" <> 'dismissed' or length(trim(coalesce("hint"."reason", ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "org_setting" DROP CONSTRAINT "org_setting_key";--> statement-breakpoint
ALTER TABLE "hint" ADD CONSTRAINT "hint_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hint" ADD CONSTRAINT "hint_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hint_org_status" ON "hint" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "hint_rule" ON "hint" USING btree ("org_id","rule_key","relationship_id");--> statement-breakpoint
ALTER TABLE "org_setting" ADD CONSTRAINT "org_setting_key" CHECK ("org_setting"."key" in ('action_reminder_days', 'fiscal_year_start_month', 'hint_max_focus_per_sro'));--> statement-breakpoint
SELECT app_apply_layer('hint', 'org_private');--> statement-breakpoint

-- FS-01: Der tägliche Job prüft die Regeln je Käufer in dessen Mandanten-Session. Die Funktion
-- nennt nur die IDs der Käufer mit aktiven Beziehungen, keine Inhalte; sie läuft als die enge
-- Rolle der Maßnahmen-Jobs, die relationship schon lesen darf (0063).
CREATE FUNCTION app_hint_orgs()
  RETURNS TABLE (org_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
  SELECT DISTINCT r.buyer_org_id FROM relationship r WHERE r.status = 'active' ORDER BY 1
$$;--> statement-breakpoint
ALTER FUNCTION app_hint_orgs() OWNER TO reziproq_action_jobs;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_hint_orgs() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_hint_orgs() TO reziproq_api;
