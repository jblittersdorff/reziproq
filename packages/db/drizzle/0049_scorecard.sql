CREATE TABLE "scorecard" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"jbp_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scorecard_status" CHECK ("scorecard"."status" in ('draft', 'signed')),
	CONSTRAINT "scorecard_version" CHECK ("scorecard"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "scorecard_kpi" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"scorecard_id" uuid NOT NULL,
	"initiative_id" uuid,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"direction" text NOT NULL,
	"baseline" numeric(18, 4),
	"target" numeric(18, 4) NOT NULL,
	"target_date" date NOT NULL,
	"owner_side" text NOT NULL,
	"owner_user_id" text,
	"owner_name" text NOT NULL,
	"benefit_for" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scorecard_kpi_direction" CHECK ("scorecard_kpi"."direction" in ('higher', 'lower')),
	CONSTRAINT "scorecard_kpi_owner_side" CHECK ("scorecard_kpi"."owner_side" in ('buyer', 'supplier')),
	CONSTRAINT "scorecard_kpi_benefit" CHECK ("scorecard_kpi"."benefit_for" in ('buyer', 'supplier', 'both')),
	CONSTRAINT "scorecard_kpi_name" CHECK (length(trim("scorecard_kpi"."name")) between 1 and 120),
	CONSTRAINT "scorecard_kpi_unit" CHECK (length(trim("scorecard_kpi"."unit")) between 1 and 30),
	CONSTRAINT "scorecard_kpi_owner" CHECK (length(trim("scorecard_kpi"."owner_name")) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "scorecard_signature" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"scorecard_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"side" text NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"signed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scorecard_signature_side" CHECK ("scorecard_signature"."side" in ('buyer', 'supplier'))
);
--> statement-breakpoint
ALTER TABLE "scorecard" ADD CONSTRAINT "scorecard_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard" ADD CONSTRAINT "scorecard_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard" ADD CONSTRAINT "scorecard_jbp_id_jbp_id_fk" FOREIGN KEY ("jbp_id") REFERENCES "public"."jbp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_kpi" ADD CONSTRAINT "scorecard_kpi_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_kpi" ADD CONSTRAINT "scorecard_kpi_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_kpi" ADD CONSTRAINT "scorecard_kpi_scorecard_id_scorecard_id_fk" FOREIGN KEY ("scorecard_id") REFERENCES "public"."scorecard"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_kpi" ADD CONSTRAINT "scorecard_kpi_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_signature" ADD CONSTRAINT "scorecard_signature_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_signature" ADD CONSTRAINT "scorecard_signature_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorecard_signature" ADD CONSTRAINT "scorecard_signature_scorecard_id_scorecard_id_fk" FOREIGN KEY ("scorecard_id") REFERENCES "public"."scorecard"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scorecard_jbp" ON "scorecard" USING btree ("jbp_id");--> statement-breakpoint
CREATE INDEX "scorecard_kpi_scorecard" ON "scorecard_kpi" USING btree ("scorecard_id");--> statement-breakpoint
CREATE INDEX "scorecard_signature_scorecard" ON "scorecard_signature" USING btree ("scorecard_id","version");--> statement-breakpoint
SELECT app_apply_layer('scorecard', 'shared');--> statement-breakpoint
SELECT app_apply_layer('scorecard_kpi', 'shared');--> statement-breakpoint
SELECT app_apply_layer('scorecard_signature', 'shared');--> statement-breakpoint
REVOKE UPDATE, DELETE ON "scorecard_signature" FROM reziproq_app;--> statement-breakpoint

-- JBP-07: Status und Version der Scorecard ändern beide Seiten; die Zeile gehört der Seite, die
-- sie angelegt hat. Übergänge:
--   draft → signed       nur mit Unterschriften beider Seiten unter die laufende Version
--   draft → revise       neue Versionsnummer, wenn sich Kennzahlen nach einer Unterschrift ändern
--   signed → new_version zurück in den Entwurf mit neuer Versionsnummer
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reziproq_scorecard') THEN
    CREATE ROLE reziproq_scorecard NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint
GRANT reziproq_scorecard TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_scorecard;--> statement-breakpoint
GRANT SELECT ON "scorecard", "scorecard_signature" TO reziproq_scorecard;--> statement-breakpoint
GRANT UPDATE ("status", "version") ON "scorecard" TO reziproq_scorecard;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_is_relationship_party(uuid), app_is_relationship_buyer(uuid),
  app_is_relationship_supplier(uuid), app_can_see_relationship(uuid),
  app_relationship_customer_ok(uuid) TO reziproq_scorecard;--> statement-breakpoint
CREATE POLICY scorecard_function ON "scorecard" FOR ALL TO reziproq_scorecard
  USING (visibility = 'shared') WITH CHECK (visibility = 'shared');--> statement-breakpoint
CREATE POLICY scorecard_signature_function ON "scorecard_signature" FOR SELECT
  TO reziproq_scorecard USING (visibility = 'shared');--> statement-breakpoint

CREATE FUNCTION app_scorecard_transition(p_id uuid, p_to text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_relationship uuid;
  v_status text;
  v_version integer;
BEGIN
  SELECT relationship_id, status, version INTO v_relationship, v_status, v_version
  FROM scorecard WHERE id = p_id AND visibility = 'shared';
  IF v_relationship IS NULL OR NOT app_is_relationship_party(v_relationship) THEN
    RAISE EXCEPTION 'scorecard_not_found';
  END IF;
  IF p_to = 'signed' AND v_status = 'draft'
    AND EXISTS (SELECT 1 FROM scorecard_signature s WHERE s.scorecard_id = p_id
      AND s.version = v_version AND s.side = 'buyer')
    AND EXISTS (SELECT 1 FROM scorecard_signature s WHERE s.scorecard_id = p_id
      AND s.version = v_version AND s.side = 'supplier') THEN
    UPDATE scorecard SET status = 'signed' WHERE id = p_id;
  ELSIF p_to = 'revise' AND v_status = 'draft' THEN
    UPDATE scorecard SET version = v_version + 1 WHERE id = p_id;
  ELSIF p_to = 'new_version' AND v_status = 'signed' THEN
    UPDATE scorecard SET status = 'draft', version = v_version + 1 WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'scorecard_transition_not_allowed';
  END IF;
END
$$;--> statement-breakpoint
ALTER FUNCTION app_scorecard_transition(uuid, text) OWNER TO reziproq_scorecard;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_scorecard_transition(uuid, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_scorecard_transition(uuid, text) TO reziproq_app;
