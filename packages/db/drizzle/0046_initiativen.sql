CREATE TABLE "initiative" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"jbp_id" uuid NOT NULL,
	"title" text NOT NULL,
	"goal" text NOT NULL,
	"benefit_buyer" text NOT NULL,
	"benefit_supplier" text NOT NULL,
	"owner_buyer_user_id" text,
	"owner_buyer_name" text NOT NULL,
	"owner_supplier_user_id" text,
	"owner_supplier_name" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"created_by" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "initiative_status" CHECK ("initiative"."status" in ('planned', 'running', 'done', 'stopped')),
	CONSTRAINT "initiative_title" CHECK (length(trim("initiative"."title")) between 1 and 200),
	CONSTRAINT "initiative_goal" CHECK (length(trim("initiative"."goal")) between 1 and 2000),
	CONSTRAINT "initiative_benefits" CHECK (length(trim("initiative"."benefit_buyer")) between 1 and 2000 and length(trim("initiative"."benefit_supplier")) between 1 and 2000),
	CONSTRAINT "initiative_owners" CHECK (length(trim("initiative"."owner_buyer_name")) between 1 and 200 and length(trim("initiative"."owner_supplier_name")) between 1 and 200),
	CONSTRAINT "initiative_period" CHECK ("initiative"."ends_on" >= "initiative"."starts_on")
);
--> statement-breakpoint
CREATE TABLE "initiative_milestone" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"initiative_id" uuid NOT NULL,
	"title" text NOT NULL,
	"due_on" date NOT NULL,
	"done_on" date,
	CONSTRAINT "initiative_milestone_title" CHECK (length(trim("initiative_milestone"."title")) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "initiative_topic" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"initiative_id" uuid NOT NULL,
	"jbp_topic_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_jbp_id_jbp_id_fk" FOREIGN KEY ("jbp_id") REFERENCES "public"."jbp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_milestone" ADD CONSTRAINT "initiative_milestone_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_milestone" ADD CONSTRAINT "initiative_milestone_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_milestone" ADD CONSTRAINT "initiative_milestone_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_topic" ADD CONSTRAINT "initiative_topic_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_topic" ADD CONSTRAINT "initiative_topic_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_topic" ADD CONSTRAINT "initiative_topic_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_topic" ADD CONSTRAINT "initiative_topic_jbp_topic_id_jbp_topic_id_fk" FOREIGN KEY ("jbp_topic_id") REFERENCES "public"."jbp_topic"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "initiative_jbp" ON "initiative" USING btree ("jbp_id","starts_on");--> statement-breakpoint
CREATE INDEX "initiative_topic_topic" ON "initiative_topic" USING btree ("jbp_topic_id");--> statement-breakpoint
CREATE INDEX "initiative_milestone_initiative" ON "initiative_milestone" USING btree ("initiative_id","due_on");--> statement-breakpoint
SELECT app_apply_layer('initiative', 'shared');--> statement-breakpoint
SELECT app_apply_layer('initiative_topic', 'shared');--> statement-breakpoint
SELECT app_apply_layer('initiative_milestone', 'shared');--> statement-breakpoint

-- JBP-03: Initiativen bearbeiten beide Seiten, die Zeile gehört aber der Seite, die sie angelegt
-- hat. Alle Änderungen laufen über diese Funktionen mit eigener, enger Rolle: Sie prüfen, ob die
-- Session zu einer Seite der Beziehung gehört, und nach der Freigabe des Plans (JBP-06) sind nur
-- noch Status und Meilensteine änderbar.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reziproq_initiativen') THEN
    CREATE ROLE reziproq_initiativen NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint
GRANT reziproq_initiativen TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_initiativen;--> statement-breakpoint
GRANT SELECT ON "jbp", "jbp_topic", "initiative", "initiative_milestone" TO reziproq_initiativen;--> statement-breakpoint
GRANT UPDATE ("title", "goal", "benefit_buyer", "benefit_supplier", "owner_buyer_name",
  "owner_supplier_name", "starts_on", "ends_on", "status", "updated_at")
  ON "initiative" TO reziproq_initiativen;--> statement-breakpoint
GRANT UPDATE ("title", "due_on", "done_on") ON "initiative_milestone" TO reziproq_initiativen;--> statement-breakpoint
GRANT DELETE ON "initiative_milestone" TO reziproq_initiativen;--> statement-breakpoint
GRANT UPDATE ("status", "updated_at") ON "jbp_topic" TO reziproq_initiativen;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_is_relationship_party(uuid), app_is_relationship_buyer(uuid),
  app_is_relationship_supplier(uuid), app_can_see_relationship(uuid),
  app_relationship_customer_ok(uuid) TO reziproq_initiativen;--> statement-breakpoint
CREATE POLICY jbp_initiative_function ON "jbp" FOR SELECT TO reziproq_initiativen
  USING (visibility = 'shared');--> statement-breakpoint
CREATE POLICY jbp_topic_initiative_function ON "jbp_topic" FOR ALL TO reziproq_initiativen
  USING (visibility = 'shared') WITH CHECK (visibility = 'shared');--> statement-breakpoint
CREATE POLICY initiative_function ON "initiative" FOR ALL TO reziproq_initiativen
  USING (visibility = 'shared') WITH CHECK (visibility = 'shared');--> statement-breakpoint
CREATE POLICY initiative_milestone_function ON "initiative_milestone" FOR ALL TO reziproq_initiativen
  USING (visibility = 'shared') WITH CHECK (visibility = 'shared');--> statement-breakpoint

-- Prüft Beziehung und Freigabe; liefert true, wenn der Plan der Initiative freigegeben ist.
CREATE FUNCTION app_initiative_check(p_initiative_id uuid) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_relationship uuid;
  v_status text;
BEGIN
  SELECT i.relationship_id, j.status INTO v_relationship, v_status
  FROM initiative i JOIN jbp j ON j.id = i.jbp_id
  WHERE i.id = p_initiative_id AND i.visibility = 'shared';
  IF v_relationship IS NULL OR NOT app_is_relationship_party(v_relationship) THEN
    RAISE EXCEPTION 'initiative_not_found';
  END IF;
  RETURN v_status = 'approved';
END
$$;--> statement-breakpoint

CREATE FUNCTION app_initiative_save(p_id uuid, p_title text, p_goal text, p_benefit_buyer text,
  p_benefit_supplier text, p_owner_buyer_name text, p_owner_supplier_name text, p_starts_on date,
  p_ends_on date) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
BEGIN
  IF app_initiative_check(p_id) THEN
    RAISE EXCEPTION 'plan_approved';
  END IF;
  UPDATE initiative
  SET title = p_title, goal = p_goal, benefit_buyer = p_benefit_buyer,
      benefit_supplier = p_benefit_supplier, owner_buyer_name = p_owner_buyer_name,
      owner_supplier_name = p_owner_supplier_name, starts_on = p_starts_on, ends_on = p_ends_on,
      updated_at = now()
  WHERE id = p_id;
END
$$;--> statement-breakpoint

CREATE FUNCTION app_initiative_status(p_id uuid, p_status text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
BEGIN
  PERFORM app_initiative_check(p_id);
  UPDATE initiative SET status = p_status, updated_at = now() WHERE id = p_id;
END
$$;--> statement-breakpoint

CREATE FUNCTION app_initiative_milestone_save(p_id uuid, p_title text, p_due_on date,
  p_done_on date) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_initiative uuid;
BEGIN
  SELECT initiative_id INTO v_initiative FROM initiative_milestone WHERE id = p_id;
  IF v_initiative IS NULL THEN
    RAISE EXCEPTION 'milestone_not_found';
  END IF;
  PERFORM app_initiative_check(v_initiative);
  UPDATE initiative_milestone SET title = p_title, due_on = p_due_on, done_on = p_done_on
  WHERE id = p_id;
END
$$;--> statement-breakpoint

CREATE FUNCTION app_initiative_milestone_delete(p_id uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_initiative uuid;
BEGIN
  SELECT initiative_id INTO v_initiative FROM initiative_milestone WHERE id = p_id;
  IF v_initiative IS NULL THEN
    RAISE EXCEPTION 'milestone_not_found';
  END IF;
  PERFORM app_initiative_check(v_initiative);
  DELETE FROM initiative_milestone WHERE id = p_id;
END
$$;--> statement-breakpoint

-- Zusammenführen (JBP-03): Themen beider Seiten werden merged; die Zeile gehört ihrer Seite.
CREATE FUNCTION app_jbp_topic_merge(p_topic_id uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_relationship uuid;
BEGIN
  SELECT t.relationship_id INTO v_relationship FROM jbp_topic t
  WHERE t.id = p_topic_id AND t.visibility = 'shared' AND t.status <> 'merged';
  IF v_relationship IS NULL OR NOT app_is_relationship_party(v_relationship) THEN
    RAISE EXCEPTION 'topic_not_found';
  END IF;
  UPDATE jbp_topic SET status = 'merged', updated_at = now() WHERE id = p_topic_id;
END
$$;--> statement-breakpoint
ALTER FUNCTION app_initiative_check(uuid) OWNER TO reziproq_initiativen;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_initiative_check(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_initiative_check(uuid) TO reziproq_initiativen;--> statement-breakpoint
ALTER FUNCTION app_initiative_save(uuid, text, text, text, text, text, text, date, date) OWNER TO reziproq_initiativen;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_initiative_save(uuid, text, text, text, text, text, text, date, date) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_initiative_save(uuid, text, text, text, text, text, text, date, date) TO reziproq_app;--> statement-breakpoint
ALTER FUNCTION app_initiative_status(uuid, text) OWNER TO reziproq_initiativen;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_initiative_status(uuid, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_initiative_status(uuid, text) TO reziproq_app;--> statement-breakpoint
ALTER FUNCTION app_initiative_milestone_save(uuid, text, date, date) OWNER TO reziproq_initiativen;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_initiative_milestone_save(uuid, text, date, date) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_initiative_milestone_save(uuid, text, date, date) TO reziproq_app;--> statement-breakpoint
ALTER FUNCTION app_initiative_milestone_delete(uuid) OWNER TO reziproq_initiativen;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_initiative_milestone_delete(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_initiative_milestone_delete(uuid) TO reziproq_app;--> statement-breakpoint
ALTER FUNCTION app_jbp_topic_merge(uuid) OWNER TO reziproq_initiativen;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_jbp_topic_merge(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_jbp_topic_merge(uuid) TO reziproq_app;
