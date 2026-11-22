CREATE TABLE "relationship_ebit_target" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"ebit_target_cents" bigint NOT NULL,
	"proposed_by" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relationship_ebit_target_amount" CHECK ("relationship_ebit_target"."ebit_target_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "org_setting" DROP CONSTRAINT "org_setting_key";--> statement-breakpoint
ALTER TABLE "relationship_ebit_target" ADD CONSTRAINT "relationship_ebit_target_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_ebit_target" ADD CONSTRAINT "relationship_ebit_target_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "relationship_ebit_target_once" ON "relationship_ebit_target" USING btree ("relationship_id","year");--> statement-breakpoint
ALTER TABLE "org_setting" ADD CONSTRAINT "org_setting_key" CHECK ("org_setting"."key" in ('action_reminder_days', 'fiscal_year_start_month', 'hint_max_focus_per_sro',
        'category_label_singular', 'category_label_plural', 'goal_ebit_year'));--> statement-breakpoint
SELECT app_apply_layer('relationship_ebit_target', 'org_private');
