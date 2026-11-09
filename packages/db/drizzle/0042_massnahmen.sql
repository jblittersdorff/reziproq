CREATE TABLE "action" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"owner_side" text NOT NULL,
	"owner_user_id" text,
	"owner_name" text NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"done_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "action_status" CHECK ("action"."status" in ('open', 'in_progress', 'done', 'cancelled')),
	CONSTRAINT "action_owner_side" CHECK ("action"."owner_side" in ('buyer', 'supplier')),
	CONSTRAINT "action_source_type" CHECK ("action"."source_type" in ('meeting', 'feedback_gap', 'initiative', 'manual')),
	CONSTRAINT "action_one_source" CHECK (("action"."source_type" = 'manual') = ("action"."source_id" is null)),
	CONSTRAINT "action_title" CHECK (length(trim("action"."title")) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "action_private_source" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"action_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "action" ADD CONSTRAINT "action_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action" ADD CONSTRAINT "action_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_private_source" ADD CONSTRAINT "action_private_source_action_id_action_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."action"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_private_source" ADD CONSTRAINT "action_private_source_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_private_source" ADD CONSTRAINT "action_private_source_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_relationship" ON "action" USING btree ("relationship_id","due_date");--> statement-breakpoint
CREATE INDEX "action_owner_user" ON "action" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "action_private_source_action" ON "action_private_source" USING btree ("action_id");--> statement-breakpoint
SELECT app_apply_layer('action', 'shared');--> statement-breakpoint
SELECT app_apply_layer('action_private_source', 'org_private');--> statement-breakpoint

-- Status geteilter Maßnahmen ändern beide Seiten (QBR-03), die Zeile gehört aber der Seite, die sie
-- angelegt hat. Die Funktion läuft als eigene, enge Rolle: Sie liest Maßnahmen und ändert nur
-- Status, Erledigt-Zeitpunkt und Änderungszeit, und nur, wenn die Session zu einer Seite der
-- Beziehung gehört (app_is_relationship_party prüft auch den Kundenkontext des Lieferanten).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reziproq_massnahmen') THEN
    CREATE ROLE reziproq_massnahmen NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint
GRANT reziproq_massnahmen TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_massnahmen;--> statement-breakpoint
GRANT SELECT ON "action" TO reziproq_massnahmen;--> statement-breakpoint
GRANT UPDATE ("status", "done_at", "updated_at") ON "action" TO reziproq_massnahmen;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_is_relationship_party(uuid), app_is_relationship_buyer(uuid),
  app_is_relationship_supplier(uuid), app_can_see_relationship(uuid),
  app_relationship_customer_ok(uuid) TO reziproq_massnahmen;--> statement-breakpoint
CREATE POLICY action_status_function ON "action" FOR ALL TO reziproq_massnahmen
  USING (visibility = 'shared') WITH CHECK (visibility = 'shared');--> statement-breakpoint

CREATE FUNCTION app_massnahme_status(p_action_id uuid, p_status text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_relationship uuid;
BEGIN
  SELECT a.relationship_id INTO v_relationship FROM action a
  WHERE a.id = p_action_id AND a.visibility = 'shared';
  IF v_relationship IS NULL OR NOT app_is_relationship_party(v_relationship) THEN
    RAISE EXCEPTION 'action_not_found';
  END IF;
  UPDATE action
  SET status = p_status,
      done_at = CASE WHEN p_status = 'done' THEN now() ELSE NULL END,
      updated_at = now()
  WHERE id = p_action_id;
END
$$;--> statement-breakpoint
ALTER FUNCTION app_massnahme_status(uuid, text) OWNER TO reziproq_massnahmen;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_massnahme_status(uuid, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_massnahme_status(uuid, text) TO reziproq_app;
