CREATE TABLE "material_group_supplier_map_row" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"site" text,
	"share_target" integer,
	"target_year" integer,
	"ended" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_group_supplier_map_row_once" UNIQUE("strategy_id","relationship_id"),
	CONSTRAINT "material_group_supplier_map_row_share" CHECK ("material_group_supplier_map_row"."share_target" is null or "material_group_supplier_map_row"."share_target" between 0 and 100),
	CONSTRAINT "material_group_supplier_map_row_year" CHECK ("material_group_supplier_map_row"."target_year" is not null or ("material_group_supplier_map_row"."share_target" is null and not "material_group_supplier_map_row"."ended"))
);
--> statement-breakpoint
ALTER TABLE "material_group_supplier_map_row" ADD CONSTRAINT "material_group_supplier_map_row_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_supplier_map_row" ADD CONSTRAINT "material_group_supplier_map_row_strategy_id_material_group_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."material_group_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_supplier_map_row" ADD CONSTRAINT "material_group_supplier_map_row_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_supplier_map_row" ADD CONSTRAINT "material_group_supplier_map_row_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
SELECT app_apply_layer('material_group_supplier_map_row', 'org_private');--> statement-breakpoint
CREATE TRIGGER material_group_supplier_map_row_owner BEFORE INSERT OR UPDATE ON material_group_supplier_map_row
  FOR EACH ROW EXECUTE FUNCTION app_strategy_child();
