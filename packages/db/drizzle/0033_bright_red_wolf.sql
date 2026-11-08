CREATE TABLE "plan_contribution" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"business_unit_id" uuid,
	"material_group_id" uuid,
	"assignee_user_id" text NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"done_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_contribution_one_reference" CHECK (("plan_contribution"."business_unit_id" is not null and "plan_contribution"."material_group_id" is null) or
        ("plan_contribution"."business_unit_id" is null and "plan_contribution"."material_group_id" is not null)),
	CONSTRAINT "plan_contribution_status" CHECK ("plan_contribution"."status" in ('open', 'done')),
	CONSTRAINT "plan_contribution_done_at" CHECK (("plan_contribution"."status" = 'done') = ("plan_contribution"."done_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "plan_contribution" ADD CONSTRAINT "plan_contribution_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_contribution" ADD CONSTRAINT "plan_contribution_business_unit_id_business_unit_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_contribution" ADD CONSTRAINT "plan_contribution_material_group_id_material_group_id_fk" FOREIGN KEY ("material_group_id") REFERENCES "public"."material_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_contribution" ADD CONSTRAINT "plan_contribution_assignee_user_id_app_user_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_contribution" ADD CONSTRAINT "plan_contribution_plan_relationship_fk" FOREIGN KEY ("plan_id","relationship_id") REFERENCES "public"."supplier_plan"("id","relationship_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_contribution_one_bu" ON "plan_contribution" USING btree ("plan_id","business_unit_id") WHERE "plan_contribution"."business_unit_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "plan_contribution_one_mg" ON "plan_contribution" USING btree ("plan_id","material_group_id") WHERE "plan_contribution"."material_group_id" is not null;
--> statement-breakpoint
SELECT app_apply_layer('plan_contribution', 'buyer_private');
