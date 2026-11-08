CREATE TABLE "catalog_setup" (
	"org_id" uuid PRIMARY KEY NOT NULL,
	"seeded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "format_catalog_item" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text,
	"name" jsonb NOT NULL,
	"purpose" jsonb NOT NULL,
	"level" text NOT NULL,
	"cadence" text NOT NULL,
	"min_impact_level" smallint NOT NULL,
	"for_quality_levels" smallint[] DEFAULT '{}'::smallint[] NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "format_catalog_item_level" CHECK ("format_catalog_item"."level" in ('executive', 'management', 'operational')),
	CONSTRAINT "format_catalog_item_cadence" CHECK ("format_catalog_item"."cadence" in ('monthly', 'quarterly', 'semiannual', 'annual', 'on_demand')),
	CONSTRAINT "format_catalog_item_impact" CHECK ("format_catalog_item"."min_impact_level" between 1 and 3),
	CONSTRAINT "format_catalog_item_quality" CHECK ("format_catalog_item"."for_quality_levels" <@ '{1,2,3}'::smallint[]),
	CONSTRAINT "format_catalog_item_name" CHECK (jsonb_typeof(name->'de') = 'string' AND jsonb_typeof(name->'en') = 'string'),
	CONSTRAINT "format_catalog_item_purpose" CHECK (jsonb_typeof(purpose->'de') = 'string' AND jsonb_typeof(purpose->'en') = 'string')
);
--> statement-breakpoint
CREATE TABLE "rule_catalog_item" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text,
	"kind" text NOT NULL,
	"group" text NOT NULL,
	"title" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"counterpart_id" uuid,
	"min_impact_level" smallint NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rule_catalog_item_kind" CHECK ("rule_catalog_item"."kind" in ('right', 'obligation')),
	CONSTRAINT "rule_catalog_item_group" CHECK ("rule_catalog_item"."group" in ('cost', 'protection', 'collaboration', 'growth')),
	CONSTRAINT "rule_catalog_item_level" CHECK ("rule_catalog_item"."min_impact_level" between 1 and 3),
	CONSTRAINT "rule_catalog_item_title" CHECK (jsonb_typeof(title->'de') = 'string' AND jsonb_typeof(title->'en') = 'string'),
	CONSTRAINT "rule_catalog_item_description" CHECK (jsonb_typeof(description->'de') = 'string' AND jsonb_typeof(description->'en') = 'string'),
	CONSTRAINT "rule_catalog_item_not_self" CHECK ("rule_catalog_item"."counterpart_id" <> "rule_catalog_item"."id")
);
--> statement-breakpoint
ALTER TABLE "catalog_setup" ADD CONSTRAINT "catalog_setup_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "format_catalog_item" ADD CONSTRAINT "format_catalog_item_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_catalog_item" ADD CONSTRAINT "rule_catalog_item_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_catalog_item" ADD CONSTRAINT "rule_catalog_item_counterpart_id_rule_catalog_item_id_fk" FOREIGN KEY ("counterpart_id") REFERENCES "public"."rule_catalog_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "format_catalog_item_key" ON "format_catalog_item" USING btree ("org_id","key");--> statement-breakpoint
CREATE INDEX "format_catalog_item_org" ON "format_catalog_item" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rule_catalog_item_key" ON "rule_catalog_item" USING btree ("org_id","key");--> statement-breakpoint
CREATE INDEX "rule_catalog_item_org" ON "rule_catalog_item" USING btree ("org_id");--> statement-breakpoint
-- PLB-01: Kataloge gehören der Käuferorganisation allein.
SELECT app_apply_layer('rule_catalog_item', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('format_catalog_item', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('catalog_setup', 'org_private');
