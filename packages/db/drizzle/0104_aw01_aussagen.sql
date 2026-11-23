CREATE TABLE "insight_summary" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"page_key" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" uuid,
	"period" text NOT NULL,
	"facts" jsonb NOT NULL,
	"facts_hash" text NOT NULL,
	"headline" text,
	"body" text,
	"sentences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text NOT NULL,
	"suppressed_reason" text,
	"reported_at" timestamp with time zone,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insight_summary_once" UNIQUE NULLS NOT DISTINCT("org_id","user_id","page_key","scope_type","scope_id","period"),
	CONSTRAINT "insight_summary_status" CHECK ("insight_summary"."status" in ('shown', 'suppressed')),
	CONSTRAINT "insight_summary_scope" CHECK ("insight_summary"."scope_type" in ('org', 'relationship', 'category')),
	CONSTRAINT "insight_summary_shown" CHECK ("insight_summary"."status" <> 'shown' or ("insight_summary"."headline" is not null and "insight_summary"."body" is not null))
);
--> statement-breakpoint
ALTER TABLE "insight_summary" ADD CONSTRAINT "insight_summary_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
SELECT app_apply_layer('insight_summary', 'org_private');
