CREATE TABLE "initiative_share" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"initiative_id" uuid NOT NULL,
	"buyer_share_pct" smallint NOT NULL,
	"supplier_share_pct" smallint NOT NULL,
	"rule_text" text,
	"proposed_by" text NOT NULL,
	"proposed_by_name" text NOT NULL,
	"proposed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"supplier_confirmed_by_name" text,
	"agreed_at" timestamp with time zone,
	CONSTRAINT "initiative_share_summe" CHECK ("initiative_share"."buyer_share_pct" between 0 and 100 and "initiative_share"."supplier_share_pct" between 0 and 100 and "initiative_share"."buyer_share_pct" + "initiative_share"."supplier_share_pct" = 100),
	CONSTRAINT "initiative_share_vereinbart" CHECK (("initiative_share"."agreed_at" is null) = ("initiative_share"."supplier_confirmed_by_name" is null))
);
--> statement-breakpoint
CREATE TABLE "savings_reference" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"initiative_id" uuid NOT NULL,
	"system" text NOT NULL,
	"reference" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "savings_reference_je_initiative" UNIQUE("initiative_id"),
	CONSTRAINT "savings_reference_texte" CHECK (length(trim("savings_reference"."system")) between 1 and 80 and length(trim("savings_reference"."reference")) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "supplier_benefit" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"initiative_id" uuid NOT NULL,
	"month" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"note" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_benefit_je_monat" UNIQUE("initiative_id","month"),
	CONSTRAINT "supplier_benefit_monat" CHECK (extract(day from "supplier_benefit"."month") = 1),
	CONSTRAINT "supplier_benefit_waehrung" CHECK ("supplier_benefit"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "initiative_share" ADD CONSTRAINT "initiative_share_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_share" ADD CONSTRAINT "initiative_share_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_share" ADD CONSTRAINT "initiative_share_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_reference" ADD CONSTRAINT "savings_reference_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savings_reference" ADD CONSTRAINT "savings_reference_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_benefit" ADD CONSTRAINT "supplier_benefit_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_benefit" ADD CONSTRAINT "supplier_benefit_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "initiative_share_je_initiative" ON "initiative_share" USING btree ("initiative_id") WHERE "initiative_share"."visibility" = 'shared';--> statement-breakpoint
SELECT app_apply_layer('initiative_share', 'shared');--> statement-breakpoint
SELECT app_apply_layer('supplier_benefit', 'supplier_private');--> statement-breakpoint
SELECT app_apply_layer('savings_reference', 'buyer_private');--> statement-breakpoint
-- PNL-07: Die Rechnung kennt die Vereinbarung; sie setzt die Sichtbarkeit der Wirkung.
GRANT SELECT ("initiative_id", "agreed_at", "visibility") ON "initiative_share" TO reziproq_wirkung_rechnung;--> statement-breakpoint
CREATE POLICY initiative_share_wirkung_rechnung ON "initiative_share" FOR SELECT TO reziproq_wirkung_rechnung USING (true);--> statement-breakpoint
GRANT UPDATE ("visibility") ON "initiative_value" TO reziproq_wirkung_rechnung;--> statement-breakpoint
GRANT SELECT ("id", "buyer_org_id", "supplier_org_id") ON "relationship" TO reziproq_wirkung_rechnung;--> statement-breakpoint
GRANT UPDATE ("supplier_confirmed_by_name", "agreed_at") ON "initiative_share" TO reziproq_wirkung_rechnung;--> statement-breakpoint
GRANT SELECT ("id", "relationship_id", "initiative_id", "agreed_at", "visibility") ON "initiative_share" TO reziproq_wirkung_rechnung;--> statement-breakpoint
CREATE POLICY initiative_share_wirkung_bestaetigen ON "initiative_share" FOR UPDATE TO reziproq_wirkung_rechnung USING (true) WITH CHECK (true);--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_is_relationship_supplier(uuid) TO reziproq_wirkung_rechnung;--> statement-breakpoint

-- Sichtbarkeit der berechneten Wirkung: geteilt, sobald die Teilung vereinbart ist.
CREATE FUNCTION app_initiative_value_visibility(p_initiative_id uuid) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM initiative_share s
      WHERE s.initiative_id = p_initiative_id AND s.visibility = 'shared' AND s.agreed_at IS NOT NULL
    ) THEN 'shared' ELSE 'internal' END
  $$;--> statement-breakpoint
ALTER FUNCTION app_initiative_value_visibility(uuid) OWNER TO reziproq_wirkung_rechnung;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_initiative_value_visibility(uuid) FROM PUBLIC;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_initiative_recompute(p_initiative_id uuid) RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_relationship uuid;
  v_buyer uuid;
  v_count integer;
  v_visibility text;
BEGIN
  SELECT i.relationship_id, r.buyer_org_id INTO v_relationship, v_buyer
  FROM initiative i JOIN relationship r ON r.id = i.relationship_id
  WHERE i.id = p_initiative_id;
  IF v_relationship IS NULL OR NOT app_is_relationship_buyer(v_relationship) THEN
    RAISE EXCEPTION 'initiative_not_found';
  END IF;
  v_visibility := app_initiative_value_visibility(p_initiative_id);
  -- Gesperrt sind Monate in einem von Controlling freigegebenen Zeitraum.
  DELETE FROM initiative_value v
  WHERE v.initiative_id = p_initiative_id
    AND NOT EXISTS (SELECT 1 FROM initiative_validation f WHERE f.initiative_id = p_initiative_id
      AND f.status = 'approved' AND v.month BETWEEN f.period_from AND f.period_to);
  INSERT INTO initiative_value (relationship_id, owner_org_id, visibility, initiative_id, month,
    kind, value_cents, currency, effect_type)
  SELECT v_relationship, v_buyer, v_visibility, p_initiative_id, m.month, m.kind,
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
  -- PNL-07: auch gesperrte Monate folgen der Vereinbarung.
  UPDATE initiative_value SET visibility = v_visibility
  WHERE initiative_id = p_initiative_id AND visibility <> v_visibility;
  RETURN v_count;
END
$$;--> statement-breakpoint

-- PNL-07: Der Lieferant bestätigt die Teilung; danach sehen beide Seiten die Wirkung.
CREATE FUNCTION app_initiative_share_confirm(p_share_id uuid, p_name text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_relationship uuid;
  v_initiative uuid;
BEGIN
  SELECT s.relationship_id, s.initiative_id INTO v_relationship, v_initiative
  FROM initiative_share s WHERE s.id = p_share_id AND s.visibility = 'shared';
  IF v_relationship IS NULL OR NOT app_is_relationship_supplier(v_relationship) THEN
    RAISE EXCEPTION 'share_not_found';
  END IF;
  IF length(trim(coalesce(p_name, ''))) = 0 THEN
    RAISE EXCEPTION 'name_required';
  END IF;
  UPDATE initiative_share SET supplier_confirmed_by_name = p_name, agreed_at = now()
  WHERE id = p_share_id;
  UPDATE initiative_value SET visibility = 'shared'
  WHERE initiative_id = v_initiative AND visibility <> 'shared';
END
$$;--> statement-breakpoint
ALTER FUNCTION app_initiative_share_confirm(uuid, text) OWNER TO reziproq_wirkung_rechnung;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_initiative_share_confirm(uuid, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_initiative_share_confirm(uuid, text) TO reziproq_app;
