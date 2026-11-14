CREATE TABLE "supplier_account_objective" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"text" text NOT NULL,
	"owner_user_id" text,
	"owner_name" text,
	"target_year" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_account_objective_text" CHECK (length(trim("supplier_account_objective"."text")) between 1 and 500),
	CONSTRAINT "supplier_account_objective_year" CHECK ("supplier_account_objective"."target_year" between 2000 and 2100)
);
--> statement-breakpoint
CREATE TABLE "supplier_account_plan" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"summary" text,
	"own_view_of_customer" text,
	"customer_importance" smallint,
	"updated_by" text NOT NULL,
	"updated_by_name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_account_plan_importance" CHECK ("supplier_account_plan"."customer_importance" is null or "supplier_account_plan"."customer_importance" between 1 and 5),
	CONSTRAINT "supplier_account_plan_summary" CHECK ("supplier_account_plan"."summary" is null or length("supplier_account_plan"."summary") <= 4000),
	CONSTRAINT "supplier_account_plan_view" CHECK ("supplier_account_plan"."own_view_of_customer" is null or length("supplier_account_plan"."own_view_of_customer") <= 4000)
);
--> statement-breakpoint
ALTER TABLE "supplier_account_objective" ADD CONSTRAINT "supplier_account_objective_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_account_plan" ADD CONSTRAINT "supplier_account_plan_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_account_objective_relationship" ON "supplier_account_objective" USING btree ("relationship_id");--> statement-breakpoint
CREATE INDEX "supplier_account_plan_relationship" ON "supplier_account_plan" USING btree ("relationship_id","updated_at");--> statement-breakpoint
SELECT app_apply_layer('supplier_account_plan', 'supplier_private');--> statement-breakpoint
SELECT app_apply_layer('supplier_account_objective', 'supplier_private');
