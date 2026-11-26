CREATE TABLE "task" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"space" text DEFAULT 'buyer_private' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"owner_user_id" text,
	"owner_name" text NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"source_type" text DEFAULT 'manual' NOT NULL,
	"source_id" uuid,
	"done_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"origin" text DEFAULT 'human' NOT NULL,
	"origin_run_id" uuid,
	"origin_user_id" text,
	CONSTRAINT "task_origin" CHECK ("task"."origin" in ('human', 'reziproq', 'engine', 'import')),
	CONSTRAINT "task_status" CHECK ("task"."status" in ('open', 'in_progress', 'done', 'cancelled')),
	CONSTRAINT "task_space" CHECK ("task"."space" in ('buyer_private', 'supplier_private')),
	CONSTRAINT "task_source_type" CHECK ("task"."source_type" in ('meeting', 'feedback_gap', 'initiative', 'hint', 'manual')),
	CONSTRAINT "task_one_source" CHECK (("task"."source_type" = 'manual') = ("task"."source_id" is null)),
	CONSTRAINT "task_title" CHECK (length(trim("task"."title")) between 1 and 200),
	CONSTRAINT "task_owner" CHECK (length(trim("task"."owner_name")) between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "commitment" DROP CONSTRAINT "commitment_status";--> statement-breakpoint
ALTER TABLE "commitment" DROP CONSTRAINT "commitment_jbp_id_jbp_id_fk";
--> statement-breakpoint
ALTER TABLE "commitment" ALTER COLUMN "jbp_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "commitment" ADD COLUMN "kind" text DEFAULT 'commitment' NOT NULL;--> statement-breakpoint
ALTER TABLE "commitment" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "commitment" ADD COLUMN "measure" text;--> statement-breakpoint
ALTER TABLE "commitment" ADD COLUMN "source_type" text;--> statement-breakpoint
ALTER TABLE "commitment" ADD COLUMN "source_ref" uuid;--> statement-breakpoint
ALTER TABLE "commitment" ADD COLUMN "source_span" "int4range";--> statement-breakpoint
ALTER TABLE "commitment" ADD COLUMN "supersedes_id" uuid;--> statement-breakpoint
ALTER TABLE "commitment" ADD COLUMN "condition_id" uuid;--> statement-breakpoint
ALTER TABLE "commitment" ADD COLUMN "fulfilled_evidence" jsonb;--> statement-breakpoint
ALTER TABLE "commitment" ADD COLUMN "done_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_relationship" ON "task" USING btree ("relationship_id","due_date");--> statement-breakpoint
CREATE INDEX "task_owner_user" ON "task" USING btree ("owner_user_id");--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_supersedes_id_commitment_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."commitment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_condition_id_commitment_id_fk" FOREIGN KEY ("condition_id") REFERENCES "public"."commitment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_jbp_id_jbp_id_fk" FOREIGN KEY ("jbp_id") REFERENCES "public"."jbp"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commitment_relationship" ON "commitment" USING btree ("relationship_id","due_on");--> statement-breakpoint
CREATE INDEX "commitment_supersedes" ON "commitment" USING btree ("supersedes_id");--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_kind" CHECK ("commitment"."kind" in ('commitment', 'action'));--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_source_type" CHECK ("commitment"."source_type" is null or "commitment"."source_type" in ('mail', 'meeting', 'feedback', 'hint', 'manual', 'deal', 'initiative'));--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_measure" CHECK ("commitment"."measure" is null or length(trim("commitment"."measure")) between 1 and 500);--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_not_self" CHECK ("commitment"."supersedes_id" is distinct from "commitment"."id");--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_status" CHECK ("commitment"."status" in ('open', 'kept', 'missed', 'replaced', 'withdrawn'));--> statement-breakpoint

-- ZQ-01 (K2-a.1): Aufgaben sieht nur die eigene Organisation (org_private, mit Kundenkontext des
-- Lieferanten). Der Raum der Zeile (ZA-01) folgt aus der Seite der Organisation in der Beziehung,
-- abgeleitet wie für alle Tabellen (app_row_space, E-K0-03). Gehört die Organisation nicht zur
-- Beziehung, bleibt er leer, und die Zeile scheitert an NOT NULL.
SELECT app_apply_layer('task', 'org_private');--> statement-breakpoint
CREATE FUNCTION app_task_space() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public, pg_temp
  AS $$
BEGIN
  NEW.space := app_row_space('org_private', NEW.relationship_id, NEW.org_id, NULL);
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER task_space BEFORE INSERT OR UPDATE OF org_id, relationship_id, space ON task
  FOR EACH ROW EXECUTE FUNCTION app_task_space();--> statement-breakpoint

-- Status einer geteilten Zusage ändern beide Seiten (ZQ-01 Regel 5: die andere Seite bucht mit
-- Beleg als gehalten), die Zeile gehört aber der zusagenden Seite. Wie app_massnahme_status (0042)
-- läuft die Funktion als enge Rolle reziproq_massnahmen: Sie liest Zusagen und ändert nur Status,
-- Beleg, Erledigt-Zeitpunkt und Änderungszeit, und nur für eine Seite der Beziehung.
GRANT SELECT ON "commitment" TO reziproq_massnahmen;--> statement-breakpoint
GRANT UPDATE ("status", "fulfilled_evidence", "done_at", "updated_at") ON "commitment"
  TO reziproq_massnahmen;--> statement-breakpoint
CREATE POLICY commitment_status_function ON "commitment" FOR ALL TO reziproq_massnahmen
  USING (visibility = 'shared') WITH CHECK (visibility = 'shared');--> statement-breakpoint
CREATE FUNCTION app_zusage_status(p_commitment_id uuid, p_status text, p_evidence jsonb)
  RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_relationship uuid;
BEGIN
  SELECT c.relationship_id INTO v_relationship FROM commitment c
  WHERE c.id = p_commitment_id AND c.visibility = 'shared';
  IF v_relationship IS NULL OR NOT app_is_relationship_party(v_relationship) THEN
    RAISE EXCEPTION 'commitment_not_found';
  END IF;
  UPDATE commitment
  SET status = p_status,
      fulfilled_evidence = CASE WHEN p_status = 'kept' THEN p_evidence END,
      done_at = CASE WHEN p_status = 'open' THEN NULL ELSE app_now() END,
      updated_at = app_now()
  WHERE id = p_commitment_id;
END
$$;--> statement-breakpoint
ALTER FUNCTION app_zusage_status(uuid, text, jsonb) OWNER TO reziproq_massnahmen;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_zusage_status(uuid, text, jsonb) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_zusage_status(uuid, text, jsonb) TO reziproq_app;
