CREATE TABLE "material_group_view_assignment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"view" text NOT NULL,
	"user_id" text NOT NULL,
	"assigned_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_group_view_assignment_once" UNIQUE("strategy_id","view","user_id"),
	CONSTRAINT "material_group_view_assignment_no_cost" CHECK ("material_group_view_assignment"."view" <> 'cost')
);
--> statement-breakpoint
CREATE TABLE "material_group_view_comment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"view" text NOT NULL,
	"author_user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_group_view_comment_body" CHECK (length(trim("material_group_view_comment"."body")) between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "material_group_view_assignment" ADD CONSTRAINT "material_group_view_assignment_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_view_assignment" ADD CONSTRAINT "material_group_view_assignment_strategy_id_material_group_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."material_group_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_view_assignment" ADD CONSTRAINT "material_group_view_assignment_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_view_assignment" ADD CONSTRAINT "material_group_view_assignment_assigned_by_app_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_view_comment" ADD CONSTRAINT "material_group_view_comment_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_view_comment" ADD CONSTRAINT "material_group_view_comment_strategy_id_material_group_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."material_group_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_view_comment" ADD CONSTRAINT "material_group_view_comment_author_user_id_app_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_group_view_comment_strategy" ON "material_group_view_comment" USING btree ("strategy_id","view");--> statement-breakpoint
SELECT app_apply_layer('material_group_view_assignment', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('material_group_view_comment', 'org_private');--> statement-breakpoint
CREATE TRIGGER material_group_view_assignment_owner BEFORE INSERT OR UPDATE ON material_group_view_assignment
  FOR EACH ROW EXECUTE FUNCTION app_strategy_child();--> statement-breakpoint
CREATE TRIGGER material_group_view_comment_owner BEFORE INSERT OR UPDATE ON material_group_view_comment
  FOR EACH ROW EXECUTE FUNCTION app_strategy_child();
