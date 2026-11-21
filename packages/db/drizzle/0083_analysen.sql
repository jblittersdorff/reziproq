CREATE TABLE "material_group_analysis" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"view" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_group_analysis_view" CHECK ("material_group_analysis"."view" in ('volume', 'supply_chain', 'cost', 'technology', 'revenue_finance', 'quality', 'footprint')),
	CONSTRAINT "material_group_analysis_cost_supplier" CHECK ("material_group_analysis"."view" <> 'cost' or not ("material_group_analysis"."data"::text ~* '"(relationship_?id|supplier[a-z_]*)"'))
);
--> statement-breakpoint
CREATE TABLE "material_group_candidate" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"name" text NOT NULL,
	"site" text,
	"revenue_cents" bigint,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"is_supplier" boolean DEFAULT false NOT NULL,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_group_candidate_name" CHECK (length(trim("material_group_candidate"."name")) > 0),
	CONSTRAINT "material_group_candidate_revenue" CHECK ("material_group_candidate"."revenue_cents" is null or "material_group_candidate"."revenue_cents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "material_group_analysis" ADD CONSTRAINT "material_group_analysis_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_analysis" ADD CONSTRAINT "material_group_analysis_strategy_id_material_group_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."material_group_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_analysis" ADD CONSTRAINT "material_group_analysis_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_candidate" ADD CONSTRAINT "material_group_candidate_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_candidate" ADD CONSTRAINT "material_group_candidate_strategy_id_material_group_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."material_group_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "material_group_analysis_once" ON "material_group_analysis" USING btree ("strategy_id","view");--> statement-breakpoint
CREATE INDEX "material_group_candidate_strategy" ON "material_group_candidate" USING btree ("strategy_id");--> statement-breakpoint
SELECT app_apply_layer('material_group_analysis', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('material_group_candidate', 'org_private');--> statement-breakpoint
CREATE TRIGGER material_group_analysis_owner BEFORE INSERT OR UPDATE ON material_group_analysis
  FOR EACH ROW EXECUTE FUNCTION app_strategy_child();--> statement-breakpoint
CREATE TRIGGER material_group_candidate_owner BEFORE INSERT OR UPDATE ON material_group_candidate
  FOR EACH ROW EXECUTE FUNCTION app_strategy_child();
