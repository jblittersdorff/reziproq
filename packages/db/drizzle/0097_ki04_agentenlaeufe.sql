CREATE TABLE "agent" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"kind" text NOT NULL,
	"owner_user_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	CONSTRAINT "agent_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "agent_org_key" UNIQUE("org_id","key"),
	CONSTRAINT "agent_kind_owner" CHECK (("agent"."kind" = 'system' and "agent"."owner_user_id" is null)
    or ("agent"."kind" = 'custom' and "agent"."owner_user_id" is not null)),
	CONSTRAINT "agent_status" CHECK ("agent"."status" in ('draft','pending_approval','active','paused','off'))
);
--> statement-breakpoint
CREATE TABLE "agent_org_state" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	CONSTRAINT "agent_org_state_agent_once" UNIQUE("org_id","agent_id")
);
--> statement-breakpoint
CREATE TABLE "agent_outbound_query" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"text" text NOT NULL,
	"provider" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_run" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"agent_version_id" uuid NOT NULL,
	"acting_user_id" text NOT NULL,
	"started_by" text NOT NULL,
	"trigger" text NOT NULL,
	"context_type" text,
	"context_id" uuid,
	"is_test" boolean DEFAULT false NOT NULL,
	"parent_run_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"steps_used" integer DEFAULT 0 NOT NULL,
	"cost_microcents" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"cancel_requested_at" timestamp with time zone,
	CONSTRAINT "agent_run_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "agent_run_status" CHECK ("agent_run"."status" in ('queued','running','waiting_input','done','failed','aborted_budget','cancelled')),
	CONSTRAINT "agent_run_trigger" CHECK ("agent_run"."trigger" in ('manual','schedule','event')),
	CONSTRAINT "agent_run_context" CHECK (("agent_run"."context_type" is null) = ("agent_run"."context_id" is null)),
	CONSTRAINT "agent_run_amounts" CHECK ("agent_run"."steps_used" >= 0 and "agent_run"."cost_microcents" >= 0),
	CONSTRAINT "agent_run_not_own_parent" CHECK ("agent_run"."parent_run_id" is distinct from "agent_run"."id")
);
--> statement-breakpoint
CREATE TABLE "agent_step" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"detail" jsonb,
	"tool_key" text,
	"cost_microcents" bigint DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	CONSTRAINT "agent_step_org_run_id" UNIQUE("org_id","run_id","id"),
	CONSTRAINT "agent_step_seq_once" UNIQUE("org_id","run_id","seq"),
	CONSTRAINT "agent_step_amounts" CHECK ("agent_step"."seq" > 0 and "agent_step"."cost_microcents" >= 0),
	CONSTRAINT "agent_step_kind" CHECK ("agent_step"."kind" in ('plan','read','search','model','check','draft')),
	CONSTRAINT "agent_step_status" CHECK ("agent_step"."status" in ('running','done','failed'))
);
--> statement-breakpoint
CREATE TABLE "agent_version" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"instructions" text NOT NULL,
	"tools" jsonb NOT NULL,
	"trigger" text NOT NULL,
	"schedule" text,
	"event_key" text,
	"scope" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"output_target" text NOT NULL,
	"reviewer_rule" text NOT NULL,
	"model_class" text NOT NULL,
	"budget_cents" integer NOT NULL,
	"max_steps" integer NOT NULL,
	"created_by" text,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	CONSTRAINT "agent_version_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "agent_version_number" UNIQUE("org_id","agent_id","version"),
	CONSTRAINT "agent_version_limits" CHECK ("agent_version"."version" > 0 and "agent_version"."budget_cents" > 0 and "agent_version"."max_steps" > 0),
	CONSTRAINT "agent_version_model_class" CHECK ("agent_version"."model_class" in ('small','standard','synthesis')),
	CONSTRAINT "agent_version_trigger" CHECK (
    ("agent_version"."trigger" = 'manual' and "agent_version"."schedule" is null and "agent_version"."event_key" is null) or
    ("agent_version"."trigger" = 'schedule' and "agent_version"."schedule" is not null and "agent_version"."event_key" is null) or
    ("agent_version"."trigger" = 'event' and "agent_version"."schedule" is null and "agent_version"."event_key" is not null))
);
--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_org_state" ADD CONSTRAINT "agent_org_state_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_org_state" ADD CONSTRAINT "agent_org_state_agent" FOREIGN KEY ("org_id","agent_id") REFERENCES "public"."agent"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_outbound_query" ADD CONSTRAINT "agent_outbound_query_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_outbound_query" ADD CONSTRAINT "agent_query_step" FOREIGN KEY ("org_id","run_id","step_id") REFERENCES "public"."agent_step"("org_id","run_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_version" FOREIGN KEY ("org_id","agent_version_id") REFERENCES "public"."agent_version"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_parent" FOREIGN KEY ("org_id","parent_run_id") REFERENCES "public"."agent_run"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_step" ADD CONSTRAINT "agent_step_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_step" ADD CONSTRAINT "agent_step_run" FOREIGN KEY ("org_id","run_id") REFERENCES "public"."agent_run"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_version" ADD CONSTRAINT "agent_version_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_version" ADD CONSTRAINT "agent_version_agent" FOREIGN KEY ("org_id","agent_id") REFERENCES "public"."agent"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_query_run" ON "agent_outbound_query" USING btree ("org_id","run_id");--> statement-breakpoint
CREATE INDEX "agent_run_org_date" ON "agent_run" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_run_parent_lookup" ON "agent_run" USING btree ("org_id","parent_run_id");
--> statement-breakpoint
SELECT app_apply_layer('agent', 'org_private');
--> statement-breakpoint
SELECT app_apply_layer('agent_org_state', 'org_private');
--> statement-breakpoint
SELECT app_apply_layer('agent_outbound_query', 'org_private');
--> statement-breakpoint
SELECT app_apply_layer('agent_run', 'org_private');
--> statement-breakpoint
SELECT app_apply_layer('agent_step', 'org_private');
--> statement-breakpoint
SELECT app_apply_layer('agent_version', 'org_private');
