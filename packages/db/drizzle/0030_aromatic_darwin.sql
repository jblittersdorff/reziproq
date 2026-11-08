CREATE TABLE "objective_category" (
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"position" smallint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "objective_category_org_id_key_pk" PRIMARY KEY("org_id","key"),
	CONSTRAINT "objective_category_key" CHECK ("objective_category"."key" ~ '^[a-z][a-z0-9_-]{0,39}$'),
	CONSTRAINT "objective_category_name" CHECK (length(trim("objective_category"."name")) between 1 and 100),
	CONSTRAINT "objective_category_position" CHECK ("objective_category"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "plan_objective" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"category_key" text NOT NULL,
	"business_unit_id" uuid,
	"material_group_id" uuid,
	"text" text NOT NULL,
	"owner_user_id" text NOT NULL,
	"target_year" integer NOT NULL,
	CONSTRAINT "plan_objective_unique_target" UNIQUE("id","relationship_id"),
	CONSTRAINT "plan_objective_one_reference" CHECK (("plan_objective"."business_unit_id" is not null and "plan_objective"."material_group_id" is null) or
        ("plan_objective"."business_unit_id" is null and "plan_objective"."material_group_id" is not null)),
	CONSTRAINT "plan_objective_text" CHECK (length(trim("plan_objective"."text")) between 1 and 2000),
	CONSTRAINT "plan_objective_year" CHECK ("plan_objective"."target_year" between 1900 and 9999)
);
--> statement-breakpoint
CREATE TABLE "supplier_plan" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_plan_cycle_version" UNIQUE("cycle_id","version"),
	CONSTRAINT "supplier_plan_id_relationship" UNIQUE("id","relationship_id"),
	CONSTRAINT "supplier_plan_version" CHECK ("supplier_plan"."version" > 0),
	CONSTRAINT "supplier_plan_status" CHECK ("supplier_plan"."status" in ('draft', 'in_review', 'approved', 'superseded'))
);
--> statement-breakpoint
ALTER TABLE "objective_category" ADD CONSTRAINT "objective_category_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_objective" ADD CONSTRAINT "plan_objective_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_objective" ADD CONSTRAINT "plan_objective_business_unit_id_business_unit_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_objective" ADD CONSTRAINT "plan_objective_material_group_id_material_group_id_fk" FOREIGN KEY ("material_group_id") REFERENCES "public"."material_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_objective" ADD CONSTRAINT "plan_objective_owner_user_id_app_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_objective" ADD CONSTRAINT "plan_objective_plan_relationship_fk" FOREIGN KEY ("plan_id","relationship_id") REFERENCES "public"."supplier_plan"("id","relationship_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_plan" ADD CONSTRAINT "supplier_plan_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_plan" ADD CONSTRAINT "supplier_plan_cycle_id_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_plan_one_draft" ON "supplier_plan" USING btree ("cycle_id") WHERE "supplier_plan"."status" = 'draft';
--> statement-breakpoint
INSERT INTO "objective_category" ("org_id", "key", "name", "position")
SELECT f."organization_id", c."key", c."name", c."position"
FROM "organization_feature" f
CROSS JOIN (VALUES
	('cost', 'Kosten', 1),
	('quality', 'Qualität', 2),
	('technology', 'Technologie', 3),
	('supply', 'Versorgung', 4),
	('sustainability', 'Nachhaltigkeit', 5),
	('capacity', 'Kapazität', 6),
	('location', 'Standort', 7)
) AS c("key", "name", "position")
WHERE f."feature" = 'buyer';
--> statement-breakpoint
SELECT app_apply_layer('objective_category', 'org_private');
--> statement-breakpoint
SELECT app_apply_layer('supplier_plan', 'buyer_private');
--> statement-breakpoint
SELECT app_apply_layer('plan_objective', 'buyer_private');