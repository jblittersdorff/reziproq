CREATE TABLE "material_group_initiative" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	"lever_choice_id" uuid NOT NULL,
	"name" text NOT NULL,
	"effect" text DEFAULT '' NOT NULL,
	"actual" numeric(14, 4),
	"target" numeric(14, 4),
	"owner_user_id" text,
	"target_quarter" integer,
	"target_year" integer,
	"progress" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_group_initiative_name" CHECK (length(trim("material_group_initiative"."name")) between 1 and 200),
	CONSTRAINT "material_group_initiative_progress" CHECK ("material_group_initiative"."progress" between 0 and 100),
	CONSTRAINT "material_group_initiative_quarter" CHECK ("material_group_initiative"."target_quarter" is null or "material_group_initiative"."target_quarter" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "material_group_initiative_supplier" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"initiative_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	CONSTRAINT "material_group_initiative_supplier_once" UNIQUE("initiative_id","relationship_id")
);
--> statement-breakpoint
CREATE TABLE "material_group_review" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"due_on" date NOT NULL,
	"held_at" timestamp with time zone,
	"held_by" text,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_group_review_once" UNIQUE("strategy_id","due_on"),
	CONSTRAINT "material_group_review_held" CHECK ("material_group_review"."held_at" is null or length(trim(coalesce("material_group_review"."summary", ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "material_group_initiative" ADD CONSTRAINT "material_group_initiative_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_initiative" ADD CONSTRAINT "material_group_initiative_strategy_id_material_group_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."material_group_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_initiative" ADD CONSTRAINT "material_group_initiative_goal_id_material_group_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."material_group_goal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_initiative" ADD CONSTRAINT "material_group_initiative_lever_choice_id_material_group_lever_choice_id_fk" FOREIGN KEY ("lever_choice_id") REFERENCES "public"."material_group_lever_choice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_initiative" ADD CONSTRAINT "material_group_initiative_owner_user_id_app_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_initiative_supplier" ADD CONSTRAINT "material_group_initiative_supplier_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_initiative_supplier" ADD CONSTRAINT "material_group_initiative_supplier_strategy_id_material_group_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."material_group_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_initiative_supplier" ADD CONSTRAINT "material_group_initiative_supplier_initiative_id_material_group_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."material_group_initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_initiative_supplier" ADD CONSTRAINT "material_group_initiative_supplier_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_review" ADD CONSTRAINT "material_group_review_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_review" ADD CONSTRAINT "material_group_review_strategy_id_material_group_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."material_group_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_review" ADD CONSTRAINT "material_group_review_held_by_app_user_id_fk" FOREIGN KEY ("held_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_group_initiative_strategy" ON "material_group_initiative" USING btree ("strategy_id");--> statement-breakpoint
SELECT app_apply_layer('material_group_initiative', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('material_group_initiative_supplier', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('material_group_review', 'org_private');--> statement-breakpoint
CREATE TRIGGER material_group_initiative_owner BEFORE INSERT OR UPDATE ON material_group_initiative
  FOR EACH ROW EXECUTE FUNCTION app_strategy_child();--> statement-breakpoint
CREATE TRIGGER material_group_initiative_supplier_owner BEFORE INSERT OR UPDATE ON material_group_initiative_supplier
  FOR EACH ROW EXECUTE FUNCTION app_strategy_child();--> statement-breakpoint
CREATE TRIGGER material_group_review_owner BEFORE INSERT OR UPDATE ON material_group_review
  FOR EACH ROW EXECUTE FUNCTION app_strategy_child();
