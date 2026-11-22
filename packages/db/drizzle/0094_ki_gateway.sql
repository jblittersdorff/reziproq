CREATE TABLE "model_call" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"run_id" uuid,
	"feature" text NOT NULL,
	"model_class" text NOT NULL,
	"provider" text NOT NULL,
	"model_id" text NOT NULL,
	"region" text NOT NULL,
	"outcome" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_microcents" bigint DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_call_class" CHECK ("model_call"."model_class" in ('small', 'standard', 'synthesis')),
	CONSTRAINT "model_call_provider" CHECK ("model_call"."provider" in ('bedrock_eu', 'fake', 'anthropic')),
	CONSTRAINT "model_call_outcome" CHECK ("model_call"."outcome" in ('ok', 'failed', 'rejected_region', 'rejected_budget')),
	CONSTRAINT "model_call_amounts" CHECK ("model_call"."input_tokens" >= 0 and "model_call"."output_tokens" >= 0 and "model_call"."cost_microcents" >= 0)
);
--> statement-breakpoint
ALTER TABLE "org_setting" DROP CONSTRAINT "org_setting_key";--> statement-breakpoint
ALTER TABLE "model_call" ADD CONSTRAINT "model_call_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_call_org_month" ON "model_call" USING btree ("org_id","created_at");--> statement-breakpoint
ALTER TABLE "org_setting" ADD CONSTRAINT "org_setting_key" CHECK ("org_setting"."key" in ('action_reminder_days', 'fiscal_year_start_month', 'hint_max_focus_per_sro',
        'category_label_singular', 'category_label_plural', 'goal_ebit_year',
        'ai_public_research', 'ai_source_kinds', 'ai_budget_month_cents', 'ai_budget_run_cents',
        'ai_max_steps', 'ai_custom_agent_roles', 'ai_custom_agent_approval',
        'ai_agent_budget_overrides'));--> statement-breakpoint
SELECT app_apply_layer('model_call', 'org_private');
