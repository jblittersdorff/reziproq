CREATE TABLE "material_group_approval" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"role" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"comment" text,
	"decided_at" timestamp with time zone,
	CONSTRAINT "material_group_approval_once" UNIQUE("strategy_id","submitted_at","role","user_id"),
	CONSTRAINT "material_group_approval_role" CHECK ("material_group_approval"."role" in ('lead', 'commodity_manager', 'approver')),
	CONSTRAINT "material_group_approval_status" CHECK ("material_group_approval"."status" in ('open', 'signed', 'returned')),
	CONSTRAINT "material_group_approval_comment" CHECK ("material_group_approval"."status" <> 'returned' or length(trim(coalesce("material_group_approval"."comment", ''))) > 0)
);
--> statement-breakpoint
CREATE TABLE "material_group_relevance" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"material_group_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score" numeric(3, 2),
	"override" text,
	"override_reason" text,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_group_relevance_once" UNIQUE("material_group_id","year"),
	CONSTRAINT "material_group_relevance_override" CHECK ("material_group_relevance"."override" is null or ("material_group_relevance"."override" in ('high', 'low') and length(trim(coalesce("material_group_relevance"."override_reason", ''))) > 0))
);
--> statement-breakpoint
CREATE TABLE "material_group_summary" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"status_quo" text DEFAULT '' NOT NULL,
	"target_state" text DEFAULT '' NOT NULL,
	"roadmap" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"submitted" jsonb,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_group_summary_once" UNIQUE("strategy_id"),
	CONSTRAINT "material_group_summary_status" CHECK ("material_group_summary"."status" in ('draft', 'confirmed'))
);
--> statement-breakpoint
ALTER TABLE "org_setting" DROP CONSTRAINT "org_setting_key";--> statement-breakpoint
ALTER TABLE "material_group_approval" ADD CONSTRAINT "material_group_approval_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_approval" ADD CONSTRAINT "material_group_approval_strategy_id_material_group_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."material_group_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_approval" ADD CONSTRAINT "material_group_approval_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_relevance" ADD CONSTRAINT "material_group_relevance_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_relevance" ADD CONSTRAINT "material_group_relevance_material_group_id_material_group_id_fk" FOREIGN KEY ("material_group_id") REFERENCES "public"."material_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_relevance" ADD CONSTRAINT "material_group_relevance_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_summary" ADD CONSTRAINT "material_group_summary_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_summary" ADD CONSTRAINT "material_group_summary_strategy_id_material_group_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."material_group_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_summary" ADD CONSTRAINT "material_group_summary_updated_by_app_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_group_approval_user" ON "material_group_approval" USING btree ("user_id","status");--> statement-breakpoint
ALTER TABLE "org_setting" ADD CONSTRAINT "org_setting_key" CHECK ("org_setting"."key" in ('action_reminder_days', 'fiscal_year_start_month', 'hint_max_focus_per_sro',
        'category_label_singular', 'category_label_plural', 'goal_ebit_year',
        'ai_public_research', 'ai_source_kinds', 'ai_budget_month_cents', 'ai_budget_run_cents',
        'ai_max_steps', 'ai_custom_agent_roles', 'ai_custom_agent_approval',
        'ai_agent_budget_overrides', 'ai_value_finder_segments', 'ai_value_assumptions', 'hint_rules', 'hint_thresholds', 'brief_lead_days', 'notify_teams_app', 'notify_mail', 'transcripts_enabled',
        'works_agreement_confirmed_at', 'works_agreement_confirmed_by', 'works_agreement_file_key',
        'transcript_retention_days', 'teams_transcript_mode', 'invite_notice_text', 'award_eligibility', 'category_approval'));--> statement-breakpoint
SELECT app_apply_layer('material_group_relevance', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('material_group_summary', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('material_group_approval', 'org_private');--> statement-breakpoint
CREATE TRIGGER material_group_summary_owner BEFORE INSERT OR UPDATE ON material_group_summary
  FOR EACH ROW EXECUTE FUNCTION app_strategy_child();--> statement-breakpoint
CREATE TRIGGER material_group_approval_owner BEFORE INSERT OR UPDATE ON material_group_approval
  FOR EACH ROW EXECUTE FUNCTION app_strategy_child();
