ALTER TABLE "org_setting" DROP CONSTRAINT "org_setting_key";--> statement-breakpoint
ALTER TABLE "org_setting" ADD CONSTRAINT "org_setting_key" CHECK ("org_setting"."key" in ('action_reminder_days', 'fiscal_year_start_month', 'hint_max_focus_per_sro',
        'category_label_singular', 'category_label_plural', 'goal_ebit_year',
        'ai_public_research', 'ai_source_kinds', 'ai_budget_month_cents', 'ai_budget_run_cents',
        'ai_max_steps', 'ai_custom_agent_roles', 'ai_custom_agent_approval',
        'ai_agent_budget_overrides', 'ai_value_finder_segments', 'ai_value_assumptions'));