CREATE TABLE "ai_source" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"draft_id" uuid,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"published_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_source_kind" CHECK ("ai_source"."kind" in ('own_data', 'public')),
	CONSTRAINT "ai_source_title" CHECK (length(trim("ai_source"."title")) > 0)
);
--> statement-breakpoint
CREATE TABLE "material_group_market_force" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"force" text NOT NULL,
	"today" text,
	"future" text,
	"relevant" boolean,
	"points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"confirmed_by" text,
	"confirmed_at" timestamp with time zone,
	"proposal" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_group_market_force_force" CHECK ("material_group_market_force"."force" in ('supplier_power', 'customer_power', 'new_entrants', 'substitutes', 'external_factors', 'rivalry')),
	CONSTRAINT "material_group_market_force_levels" CHECK (("material_group_market_force"."today" is null or "material_group_market_force"."today" in ('low', 'high')) and ("material_group_market_force"."future" is null or "material_group_market_force"."future" in ('low', 'high'))),
	CONSTRAINT "material_group_market_force_status" CHECK ("material_group_market_force"."status" in ('draft', 'confirmed')),
	CONSTRAINT "material_group_market_force_confirmed" CHECK ("material_group_market_force"."status" <> 'confirmed' or ("material_group_market_force"."today" is not null and "material_group_market_force"."future" is not null and "material_group_market_force"."relevant" is not null and "material_group_market_force"."confirmed_by" is not null))
);
--> statement-breakpoint
ALTER TABLE "ai_draft" DROP CONSTRAINT "ai_draft_kind";--> statement-breakpoint
ALTER TABLE "ai_source" ADD CONSTRAINT "ai_source_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_source" ADD CONSTRAINT "ai_source_draft_id_ai_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."ai_draft"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_market_force" ADD CONSTRAINT "material_group_market_force_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_market_force" ADD CONSTRAINT "material_group_market_force_strategy_id_material_group_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."material_group_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_market_force" ADD CONSTRAINT "material_group_market_force_confirmed_by_app_user_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_source_target" ON "ai_source" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "material_group_market_force_once" ON "material_group_market_force" USING btree ("strategy_id","force");--> statement-breakpoint
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_kind" CHECK ("ai_draft"."kind" in ('deviation_explanation', 'feedback_themes', 'plan_summary', 'pre_read', 'market_analysis'));--> statement-breakpoint
SELECT app_apply_layer('material_group_market_force', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('ai_source', 'org_private');--> statement-breakpoint
CREATE TRIGGER material_group_market_force_owner BEFORE INSERT OR UPDATE ON material_group_market_force
  FOR EACH ROW EXECUTE FUNCTION app_strategy_child();
