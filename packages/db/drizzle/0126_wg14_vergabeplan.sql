CREATE TABLE "material_group_award" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"name" text NOT NULL,
	"volume_cents" bigint,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"request_from" date,
	"request_to" date,
	"award_date" date,
	"bundle_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_group_award_name" CHECK (length(trim("material_group_award"."name")) > 0),
	CONSTRAINT "material_group_award_volume" CHECK ("material_group_award"."volume_cents" is null or "material_group_award"."volume_cents" >= 0),
	CONSTRAINT "material_group_award_request" CHECK ("material_group_award"."request_from" is null or "material_group_award"."request_to" is null or "material_group_award"."request_from" <= "material_group_award"."request_to")
);
--> statement-breakpoint
CREATE TABLE "material_group_award_supplier" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"award_id" uuid NOT NULL,
	"relationship_id" uuid,
	"candidate_id" uuid,
	"note" text,
	CONSTRAINT "material_group_award_supplier_relationship" UNIQUE("award_id","relationship_id"),
	CONSTRAINT "material_group_award_supplier_candidate" UNIQUE("award_id","candidate_id"),
	CONSTRAINT "material_group_award_supplier_one" CHECK (("material_group_award_supplier"."relationship_id" is null) <> ("material_group_award_supplier"."candidate_id" is null))
);
--> statement-breakpoint
ALTER TABLE "org_setting" DROP CONSTRAINT "org_setting_key";--> statement-breakpoint
ALTER TABLE "material_group_award" ADD CONSTRAINT "material_group_award_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_award" ADD CONSTRAINT "material_group_award_strategy_id_material_group_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."material_group_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_award_supplier" ADD CONSTRAINT "material_group_award_supplier_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_award_supplier" ADD CONSTRAINT "material_group_award_supplier_strategy_id_material_group_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."material_group_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_award_supplier" ADD CONSTRAINT "material_group_award_supplier_award_id_material_group_award_id_fk" FOREIGN KEY ("award_id") REFERENCES "public"."material_group_award"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_award_supplier" ADD CONSTRAINT "material_group_award_supplier_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_award_supplier" ADD CONSTRAINT "material_group_award_supplier_candidate_id_material_group_candidate_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."material_group_candidate"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_group_award_strategy" ON "material_group_award" USING btree ("strategy_id");--> statement-breakpoint
ALTER TABLE "org_setting" ADD CONSTRAINT "org_setting_key" CHECK ("org_setting"."key" in ('action_reminder_days', 'fiscal_year_start_month', 'hint_max_focus_per_sro',
        'category_label_singular', 'category_label_plural', 'goal_ebit_year',
        'ai_public_research', 'ai_source_kinds', 'ai_budget_month_cents', 'ai_budget_run_cents',
        'ai_max_steps', 'ai_custom_agent_roles', 'ai_custom_agent_approval',
        'ai_agent_budget_overrides', 'ai_value_finder_segments', 'ai_value_assumptions', 'hint_rules', 'hint_thresholds', 'brief_lead_days', 'notify_teams_app', 'notify_mail', 'transcripts_enabled',
        'works_agreement_confirmed_at', 'works_agreement_confirmed_by', 'works_agreement_file_key',
        'transcript_retention_days', 'teams_transcript_mode', 'invite_notice_text', 'award_eligibility'));--> statement-breakpoint
SELECT app_apply_layer('material_group_award', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('material_group_award_supplier', 'org_private');--> statement-breakpoint
CREATE TRIGGER material_group_award_owner BEFORE INSERT OR UPDATE ON material_group_award
  FOR EACH ROW EXECUTE FUNCTION app_strategy_child();--> statement-breakpoint
CREATE TRIGGER material_group_award_supplier_owner BEFORE INSERT OR UPDATE ON material_group_award_supplier
  FOR EACH ROW EXECUTE FUNCTION app_strategy_child();
