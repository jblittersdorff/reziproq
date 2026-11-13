CREATE TABLE "initiative_input_month" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"initiative_id" uuid NOT NULL,
	"month" date NOT NULL,
	"kind" text NOT NULL,
	"inputs" jsonb NOT NULL,
	"source" text NOT NULL,
	"entered_by" text NOT NULL,
	"entered_by_name" text NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "initiative_input_month_kind" CHECK ("initiative_input_month"."kind" in ('plan', 'actual')),
	CONSTRAINT "initiative_input_month_source" CHECK ("initiative_input_month"."source" in ('manual', 'csv')),
	CONSTRAINT "initiative_input_month_first" CHECK (extract(day from "initiative_input_month"."month") = 1)
);
--> statement-breakpoint
CREATE TABLE "initiative_validation" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"initiative_id" uuid NOT NULL,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"requested_by" text NOT NULL,
	"requested_by_name" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" text,
	"decided_by_name" text,
	"decided_at" timestamp with time zone,
	"comment" text,
	CONSTRAINT "initiative_validation_status" CHECK ("initiative_validation"."status" in ('requested', 'approved', 'rejected')),
	CONSTRAINT "initiative_validation_period" CHECK ("initiative_validation"."period_to" >= "initiative_validation"."period_from"),
	CONSTRAINT "initiative_validation_comment" CHECK ("initiative_validation"."status" <> 'rejected' or length(trim(coalesce("initiative_validation"."comment", ''))) > 0)
);
--> statement-breakpoint
CREATE TABLE "initiative_value" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"initiative_id" uuid NOT NULL,
	"month" date NOT NULL,
	"kind" text NOT NULL,
	"value_cents" bigint NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"effect_type" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "initiative_value_kind" CHECK ("initiative_value"."kind" in ('plan', 'actual'))
);
--> statement-breakpoint
ALTER TABLE "initiative_input_month" ADD CONSTRAINT "initiative_input_month_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_input_month" ADD CONSTRAINT "initiative_input_month_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_validation" ADD CONSTRAINT "initiative_validation_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_validation" ADD CONSTRAINT "initiative_validation_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_value" ADD CONSTRAINT "initiative_value_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_value" ADD CONSTRAINT "initiative_value_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_value" ADD CONSTRAINT "initiative_value_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "initiative_input_month_initiative" ON "initiative_input_month" USING btree ("initiative_id","month");--> statement-breakpoint
CREATE INDEX "initiative_validation_initiative" ON "initiative_validation" USING btree ("initiative_id","status");--> statement-breakpoint
CREATE INDEX "initiative_value_initiative" ON "initiative_value" USING btree ("initiative_id","month");--> statement-breakpoint
SELECT app_apply_layer('initiative_input_month', 'buyer_private');--> statement-breakpoint
SELECT app_apply_layer('initiative_value', 'shared');--> statement-breakpoint
SELECT app_apply_layer('initiative_validation', 'buyer_private');--> statement-breakpoint
-- PNL-05: Beträge entstehen nur durch die Rechnung, nie von Hand.
REVOKE INSERT, UPDATE, DELETE ON "initiative_value" FROM reziproq_app;--> statement-breakpoint

-- Die Rechnung läuft als enge Rolle: Sie liest Wirkung, Baseline und Monatswerte (käuferprivat)
-- und schreibt nur initiative_value. Aufrufen darf nur der Käufer der Beziehung; Monate in einem
-- freigegebenen Zeitraum (PNL-06) bleiben unverändert.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reziproq_wirkung_rechnung') THEN
    CREATE ROLE reziproq_wirkung_rechnung NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint
GRANT reziproq_wirkung_rechnung TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_wirkung_rechnung;--> statement-breakpoint
GRANT SELECT ("id", "relationship_id") ON "initiative" TO reziproq_wirkung_rechnung;--> statement-breakpoint
GRANT SELECT ("id", "buyer_org_id") ON "relationship" TO reziproq_wirkung_rechnung;--> statement-breakpoint
GRANT SELECT ON "initiative_impact", "initiative_baseline", "initiative_input_month",
  "initiative_validation" TO reziproq_wirkung_rechnung;--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON "initiative_value" TO reziproq_wirkung_rechnung;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_is_relationship_party(uuid), app_is_relationship_buyer(uuid),
  app_is_relationship_supplier(uuid), app_can_see_relationship(uuid),
  app_relationship_customer_ok(uuid) TO reziproq_wirkung_rechnung;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_lever_amount(text, integer, jsonb, jsonb) TO reziproq_wirkung_rechnung;--> statement-breakpoint
CREATE POLICY initiative_wirkung_rechnung ON "initiative" FOR SELECT TO reziproq_wirkung_rechnung USING (true);--> statement-breakpoint
CREATE POLICY relationship_wirkung_rechnung ON "relationship" FOR SELECT TO reziproq_wirkung_rechnung USING (true);--> statement-breakpoint
CREATE POLICY initiative_impact_wirkung_rechnung ON "initiative_impact" FOR SELECT TO reziproq_wirkung_rechnung USING (true);--> statement-breakpoint
CREATE POLICY initiative_baseline_wirkung_rechnung ON "initiative_baseline" FOR SELECT TO reziproq_wirkung_rechnung USING (true);--> statement-breakpoint
CREATE POLICY initiative_input_month_wirkung_rechnung ON "initiative_input_month" FOR SELECT TO reziproq_wirkung_rechnung USING (true);--> statement-breakpoint
CREATE POLICY initiative_validation_wirkung_rechnung ON "initiative_validation" FOR SELECT TO reziproq_wirkung_rechnung USING (true);--> statement-breakpoint
CREATE POLICY initiative_value_wirkung_rechnung ON "initiative_value" FOR ALL TO reziproq_wirkung_rechnung USING (true) WITH CHECK (true);--> statement-breakpoint

CREATE FUNCTION app_initiative_recompute(p_initiative_id uuid) RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_relationship uuid;
  v_buyer uuid;
  v_count integer;
BEGIN
  SELECT i.relationship_id, r.buyer_org_id INTO v_relationship, v_buyer
  FROM initiative i JOIN relationship r ON r.id = i.relationship_id
  WHERE i.id = p_initiative_id;
  IF v_relationship IS NULL OR NOT app_is_relationship_buyer(v_relationship) THEN
    RAISE EXCEPTION 'initiative_not_found';
  END IF;
  -- Gesperrt sind Monate in einem von Controlling freigegebenen Zeitraum.
  DELETE FROM initiative_value v
  WHERE v.initiative_id = p_initiative_id
    AND NOT EXISTS (SELECT 1 FROM initiative_validation f WHERE f.initiative_id = p_initiative_id
      AND f.status = 'approved' AND v.month BETWEEN f.period_from AND f.period_to);
  INSERT INTO initiative_value (relationship_id, owner_org_id, visibility, initiative_id, month,
    kind, value_cents, currency, effect_type)
  SELECT v_relationship, v_buyer, 'internal', p_initiative_id, m.month, m.kind,
    app_lever_amount(w.lever, w.lever_template_version, b.inputs, m.inputs), 'EUR', w.effect_type
  FROM (
    SELECT DISTINCT ON (month, kind) month, kind, inputs
    FROM initiative_input_month
    WHERE initiative_id = p_initiative_id
    ORDER BY month, kind, entered_at DESC
  ) m
  CROSS JOIN LATERAL (
    SELECT lever, lever_template_version, effect_type FROM initiative_impact
    WHERE initiative_id = p_initiative_id ORDER BY updated_at DESC LIMIT 1
  ) w
  CROSS JOIN LATERAL (
    SELECT inputs FROM initiative_baseline
    WHERE initiative_id = p_initiative_id ORDER BY version DESC LIMIT 1
  ) b
  WHERE NOT EXISTS (SELECT 1 FROM initiative_validation f WHERE f.initiative_id = p_initiative_id
    AND f.status = 'approved' AND m.month BETWEEN f.period_from AND f.period_to);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END
$$;--> statement-breakpoint
ALTER FUNCTION app_initiative_recompute(uuid) OWNER TO reziproq_wirkung_rechnung;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_initiative_recompute(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_initiative_recompute(uuid) TO reziproq_app;
