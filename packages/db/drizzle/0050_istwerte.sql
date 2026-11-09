CREATE TABLE "kpi_value" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"kpi_id" uuid NOT NULL,
	"period" date NOT NULL,
	"value" numeric(18, 4) NOT NULL,
	"source" text NOT NULL,
	"entered_by" text NOT NULL,
	"entered_by_name" text NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kpi_value_source" CHECK ("kpi_value"."source" in ('manual', 'csv')),
	CONSTRAINT "kpi_value_period" CHECK (extract(day from "kpi_value"."period") = 1)
);
--> statement-breakpoint
CREATE TABLE "scorecard_setting" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"tolerance_percent" integer DEFAULT 10 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scorecard_setting_tolerance" CHECK ("scorecard_setting"."tolerance_percent" between 0 and 50)
);
--> statement-breakpoint
ALTER TABLE "kpi_value" ADD CONSTRAINT "kpi_value_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_value" ADD CONSTRAINT "kpi_value_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_value" ADD CONSTRAINT "kpi_value_kpi_id_scorecard_kpi_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "public"."scorecard_kpi"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_setting" ADD CONSTRAINT "scorecard_setting_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kpi_value_kpi" ON "kpi_value" USING btree ("kpi_id","period");--> statement-breakpoint
SELECT app_apply_layer('kpi_value', 'shared');--> statement-breakpoint
SELECT app_apply_layer('scorecard_setting', 'org_private');--> statement-breakpoint

-- JBP-09: Ab wann eine Kennzahl „knapp“ ist, stellt der Kunde (Käufer) ein. Beide Seiten brauchen
-- die Zahl, um den Stand gleich zu berechnen. Die Funktion gibt nur diese eine Zahl heraus und nur
-- an eine Seite der Beziehung; ohne Einstellung gilt 10.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reziproq_kennzahl_toleranz') THEN
    CREATE ROLE reziproq_kennzahl_toleranz NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint
GRANT reziproq_kennzahl_toleranz TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_kennzahl_toleranz;--> statement-breakpoint
GRANT SELECT ("id", "buyer_org_id") ON "relationship" TO reziproq_kennzahl_toleranz;--> statement-breakpoint
GRANT SELECT ("org_id", "tolerance_percent") ON "scorecard_setting" TO reziproq_kennzahl_toleranz;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_is_relationship_party(uuid), app_is_relationship_buyer(uuid),
  app_is_relationship_supplier(uuid), app_can_see_relationship(uuid),
  app_relationship_customer_ok(uuid) TO reziproq_kennzahl_toleranz;--> statement-breakpoint
CREATE POLICY relationship_kennzahl_toleranz ON "relationship" FOR SELECT
  TO reziproq_kennzahl_toleranz USING (true);--> statement-breakpoint
CREATE POLICY scorecard_setting_kennzahl_toleranz ON "scorecard_setting" FOR SELECT
  TO reziproq_kennzahl_toleranz USING (true);--> statement-breakpoint
CREATE FUNCTION app_kpi_tolerance(p_relationship_id uuid) RETURNS integer
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_tolerance integer;
BEGIN
  IF NOT app_is_relationship_party(p_relationship_id) THEN
    RAISE EXCEPTION 'relationship_not_found';
  END IF;
  SELECT s.tolerance_percent INTO v_tolerance
  FROM relationship r JOIN scorecard_setting s ON s.org_id = r.buyer_org_id
  WHERE r.id = p_relationship_id;
  RETURN coalesce(v_tolerance, 10);
END
$$;--> statement-breakpoint
ALTER FUNCTION app_kpi_tolerance(uuid) OWNER TO reziproq_kennzahl_toleranz;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_kpi_tolerance(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_kpi_tolerance(uuid) TO reziproq_app;
