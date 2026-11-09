CREATE TABLE "initiative_baseline" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"initiative_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"lever_template_version" integer NOT NULL,
	"inputs" jsonb NOT NULL,
	"frozen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"frozen_by" text NOT NULL,
	"frozen_by_name" text NOT NULL,
	"change_reason" text,
	CONSTRAINT "initiative_baseline_version" CHECK ("initiative_baseline"."version" > 0),
	CONSTRAINT "initiative_baseline_reason" CHECK ("initiative_baseline"."version" = 1 or length(trim(coalesce("initiative_baseline"."change_reason", ''))) > 0)
);
--> statement-breakpoint
CREATE TABLE "initiative_impact" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"initiative_id" uuid NOT NULL,
	"lever" text NOT NULL,
	"lever_template_version" integer NOT NULL,
	"pnl_line_key" text NOT NULL,
	"effect_type" text NOT NULL,
	"effective_from" date,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "initiative_impact_lever" CHECK ("initiative_impact"."lever" in ('price', 'cost_avoidance', 'quality', 'logistics', 'working_capital', 'innovation', 'risk')),
	CONSTRAINT "initiative_impact_effect" CHECK ("initiative_impact"."effect_type" in ('ebit', 'cost_avoidance', 'cash', 'strategic')),
	CONSTRAINT "initiative_impact_version" CHECK ("initiative_impact"."lever_template_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "maturity_step" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"initiative_id" uuid NOT NULL,
	"from_level" integer NOT NULL,
	"to_level" integer NOT NULL,
	"evidence" text NOT NULL,
	"evidence_link" text,
	"decided_by" text NOT NULL,
	"decided_by_name" text NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "maturity_step_levels" CHECK ("maturity_step"."to_level" = "maturity_step"."from_level" + 1),
	CONSTRAINT "maturity_step_range" CHECK ("maturity_step"."from_level" between 1 and 4),
	CONSTRAINT "maturity_step_evidence" CHECK (length(trim("maturity_step"."evidence")) between 1 and 2000)
);
--> statement-breakpoint
CREATE TABLE "pnl_line" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "pnl_line_key" UNIQUE("org_id","key"),
	CONSTRAINT "pnl_line_name" CHECK (length(trim("pnl_line"."name")) between 1 and 120),
	CONSTRAINT "pnl_line_key_form" CHECK ("pnl_line"."key" ~ '^[a-z][a-z0-9_]{1,40}$')
);
--> statement-breakpoint
ALTER TABLE "initiative" ADD COLUMN "source" text DEFAULT 'jbp' NOT NULL;--> statement-breakpoint
ALTER TABLE "initiative_baseline" ADD CONSTRAINT "initiative_baseline_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_baseline" ADD CONSTRAINT "initiative_baseline_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_impact" ADD CONSTRAINT "initiative_impact_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_impact" ADD CONSTRAINT "initiative_impact_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maturity_step" ADD CONSTRAINT "maturity_step_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maturity_step" ADD CONSTRAINT "maturity_step_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maturity_step" ADD CONSTRAINT "maturity_step_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pnl_line" ADD CONSTRAINT "pnl_line_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "initiative_baseline_initiative" ON "initiative_baseline" USING btree ("initiative_id","version");--> statement-breakpoint
CREATE INDEX "initiative_impact_initiative" ON "initiative_impact" USING btree ("initiative_id");--> statement-breakpoint
CREATE INDEX "maturity_step_initiative" ON "maturity_step" USING btree ("initiative_id","decided_at");--> statement-breakpoint
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_source" CHECK ("initiative"."source" in ('jbp', 'action', 'supplier_idea'));--> statement-breakpoint
SELECT app_apply_layer('pnl_line', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('initiative_impact', 'buyer_private');--> statement-breakpoint
SELECT app_apply_layer('initiative_baseline', 'buyer_private');--> statement-breakpoint
SELECT app_apply_layer('maturity_step', 'shared');--> statement-breakpoint
-- Eine eingefrorene Baseline und jede Stufe des Reifegrads sind unveränderbar (PNL-03).
REVOKE UPDATE, DELETE ON "initiative_baseline" FROM reziproq_app;--> statement-breakpoint
REVOKE UPDATE, DELETE ON "maturity_step" FROM reziproq_app;--> statement-breakpoint

-- PNL-01: Rechenregeln der Hebel-Vorlagen (packages/shared/src/levers.ts) je Version. Beträge in
-- ganzen Cent, kaufmännisch gerundet (round auf numeric rundet halb von null weg). Eine neue
-- Version kommt als neuer Zweig dazu; alte Zweige bleiben, damit Initiativen weiterrechnen.
CREATE FUNCTION app_lever_amount(p_lever text, p_version integer, p_baseline jsonb, p_month jsonb)
  RETURNS bigint LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp
  AS $$
DECLARE
  b jsonb := coalesce(p_baseline, '{}'::jsonb);
  m jsonb := coalesce(p_month, '{}'::jsonb);
BEGIN
  CASE p_lever || ':' || p_version
    WHEN 'price:1' THEN
      RETURN round(((b->>'price_old')::numeric - (m->>'price_new')::numeric)
        * (m->>'quantity')::numeric);
    WHEN 'cost_avoidance:1' THEN
      RETURN round(((b->>'price_requested')::numeric - (m->>'price_agreed')::numeric)
        * (m->>'quantity')::numeric);
    WHEN 'quality:1' THEN
      RETURN round(((b->>'defects_before')::numeric - (m->>'defects_after')::numeric)
        * (b->>'cost_per_defect')::numeric);
    WHEN 'logistics:1' THEN
      RETURN round(((b->>'unit_cost_before')::numeric - (m->>'unit_cost_after')::numeric)
        * (m->>'quantity')::numeric);
    WHEN 'working_capital:1' THEN
      RETURN round((b->>'inventory_before')::numeric - (m->>'inventory_after')::numeric);
    WHEN 'innovation:1' THEN
      RETURN round((m->>'additional_revenue')::numeric * (b->>'margin_rate')::numeric);
    WHEN 'risk:1' THEN
      RETURN round((m->>'avoided_damage')::numeric * (b->>'probability')::numeric);
    ELSE
      RAISE EXCEPTION 'lever_version_unknown: %', p_lever || ':' || p_version;
  END CASE;
END
$$;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_lever_amount(text, integer, jsonb, jsonb) TO reziproq_app;
