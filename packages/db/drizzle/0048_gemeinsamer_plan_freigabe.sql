CREATE TABLE "jbp_approval" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"jbp_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"side" text NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"decision" text NOT NULL,
	"comment" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jbp_approval_side" CHECK ("jbp_approval"."side" in ('buyer', 'supplier')),
	CONSTRAINT "jbp_approval_decision" CHECK ("jbp_approval"."decision" in ('approved', 'returned')),
	CONSTRAINT "jbp_approval_comment" CHECK ("jbp_approval"."decision" <> 'returned' or length(trim(coalesce("jbp_approval"."comment", ''))) > 0)
);
--> statement-breakpoint
CREATE TABLE "jbp_version" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"jbp_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"approved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jbp_approval" ADD CONSTRAINT "jbp_approval_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jbp_approval" ADD CONSTRAINT "jbp_approval_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jbp_approval" ADD CONSTRAINT "jbp_approval_jbp_id_jbp_id_fk" FOREIGN KEY ("jbp_id") REFERENCES "public"."jbp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jbp_version" ADD CONSTRAINT "jbp_version_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jbp_version" ADD CONSTRAINT "jbp_version_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jbp_version" ADD CONSTRAINT "jbp_version_jbp_id_jbp_id_fk" FOREIGN KEY ("jbp_id") REFERENCES "public"."jbp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jbp_approval_jbp" ON "jbp_approval" USING btree ("jbp_id","version","decided_at");--> statement-breakpoint
CREATE INDEX "jbp_version_jbp" ON "jbp_version" USING btree ("jbp_id","version");--> statement-breakpoint
SELECT app_apply_layer('jbp_approval', 'shared');--> statement-breakpoint
SELECT app_apply_layer('jbp_version', 'shared');--> statement-breakpoint
-- Entscheidungen und freigegebene Versionen sind nur anfügbar.
REVOKE UPDATE, DELETE ON "jbp_approval" FROM reziproq_app;--> statement-breakpoint
REVOKE UPDATE, DELETE ON "jbp_version" FROM reziproq_app;--> statement-breakpoint

-- JBP-06: Den Status des Gemeinsamen Plans ändern beide Seiten, die Zeile gehört dem Käufer. Die
-- Funktion läuft als enge Rolle und erlaubt nur diese Übergänge:
--   draft → in_review   nur der Käufer (zur Prüfung geben)
--   in_review → draft   nur der Lieferant (zurückgeben)
--   in_review → approved nur der Lieferant und nur, wenn beide Seiten diese Version freigegeben haben
--   approved → draft    beide Seiten, mit neuer Versionsnummer (neue Version)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reziproq_jbp_freigabe') THEN
    CREATE ROLE reziproq_jbp_freigabe NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint
GRANT reziproq_jbp_freigabe TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_jbp_freigabe;--> statement-breakpoint
GRANT SELECT ON "jbp", "jbp_approval" TO reziproq_jbp_freigabe;--> statement-breakpoint
GRANT UPDATE ("status", "version") ON "jbp" TO reziproq_jbp_freigabe;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_is_relationship_party(uuid), app_is_relationship_buyer(uuid),
  app_is_relationship_supplier(uuid), app_can_see_relationship(uuid),
  app_relationship_customer_ok(uuid) TO reziproq_jbp_freigabe;--> statement-breakpoint
CREATE POLICY jbp_freigabe_function ON "jbp" FOR ALL TO reziproq_jbp_freigabe
  USING (visibility = 'shared') WITH CHECK (visibility = 'shared');--> statement-breakpoint
CREATE POLICY jbp_approval_freigabe_function ON "jbp_approval" FOR SELECT TO reziproq_jbp_freigabe
  USING (visibility = 'shared');--> statement-breakpoint

CREATE FUNCTION app_jbp_transition(p_jbp_id uuid, p_to text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_relationship uuid;
  v_status text;
  v_version integer;
  v_buyer boolean;
BEGIN
  SELECT relationship_id, status, version INTO v_relationship, v_status, v_version
  FROM jbp WHERE id = p_jbp_id AND visibility = 'shared';
  IF v_relationship IS NULL OR NOT app_is_relationship_party(v_relationship) THEN
    RAISE EXCEPTION 'jbp_not_found';
  END IF;
  v_buyer := app_is_relationship_buyer(v_relationship);
  IF p_to = 'in_review' AND v_status = 'draft' AND v_buyer THEN
    UPDATE jbp SET status = 'in_review' WHERE id = p_jbp_id;
  ELSIF p_to = 'draft' AND v_status = 'in_review' AND NOT v_buyer THEN
    UPDATE jbp SET status = 'draft' WHERE id = p_jbp_id;
  ELSIF p_to = 'approved' AND v_status = 'in_review' AND NOT v_buyer
    AND EXISTS (SELECT 1 FROM jbp_approval a WHERE a.jbp_id = p_jbp_id AND a.version = v_version
      AND a.side = 'buyer' AND a.decision = 'approved')
    AND EXISTS (SELECT 1 FROM jbp_approval a WHERE a.jbp_id = p_jbp_id AND a.version = v_version
      AND a.side = 'supplier' AND a.decision = 'approved') THEN
    UPDATE jbp SET status = 'approved' WHERE id = p_jbp_id;
  ELSIF p_to = 'new_version' AND v_status = 'approved' THEN
    UPDATE jbp SET status = 'draft', version = v_version + 1 WHERE id = p_jbp_id;
  ELSE
    RAISE EXCEPTION 'jbp_transition_not_allowed';
  END IF;
END
$$;--> statement-breakpoint
ALTER FUNCTION app_jbp_transition(uuid, text) OWNER TO reziproq_jbp_freigabe;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_jbp_transition(uuid, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_jbp_transition(uuid, text) TO reziproq_app;
