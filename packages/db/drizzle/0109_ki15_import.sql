CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "category_rule" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"material_group_id" uuid NOT NULL,
	"field" text NOT NULL,
	"pattern" text NOT NULL,
	"created_from_row_id" uuid,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_rule_je_muster" UNIQUE("org_id","field","pattern"),
	CONSTRAINT "category_rule_field" CHECK ("category_rule"."field" in ('material_group', 'account', 'description')),
	CONSTRAINT "category_rule_pattern" CHECK (length(trim("category_rule"."pattern")) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "import_batch" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"file_name" text NOT NULL,
	"file_hash" text NOT NULL,
	"headers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"column_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"suggested_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"rows_total" integer DEFAULT 0 NOT NULL,
	"rows_ok" integer DEFAULT 0 NOT NULL,
	"rows_review" integer DEFAULT 0 NOT NULL,
	"rows_error" integer DEFAULT 0 NOT NULL,
	"run_id" uuid,
	"undo" jsonb,
	"created_by" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_by" text,
	"committed_at" timestamp with time zone,
	"reverted_at" timestamp with time zone,
	CONSTRAINT "import_batch_kind" CHECK ("import_batch"."kind" in ('supplier_master', 'spend')),
	CONSTRAINT "import_batch_status" CHECK ("import_batch"."status" in ('uploaded', 'mapped', 'processing', 'review', 'committed', 'reverted', 'failed', 'discarded')),
	CONSTRAINT "import_batch_rows" CHECK ("import_batch"."rows_total" between 0 and 50000)
);
--> statement-breakpoint
CREATE TABLE "import_row" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_no" integer NOT NULL,
	"raw" jsonb NOT NULL,
	"normalized" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"relationship_id" uuid,
	"match_method" text,
	"match_score" real,
	"match_reason" text,
	"suggestion" jsonb,
	"candidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"material_group_id" uuid,
	"category_method" text,
	"category_confidence" real,
	"category_suggestion" jsonb,
	"create_new" boolean DEFAULT false NOT NULL,
	"parent_relationship_id" uuid,
	"amount_cents" bigint,
	"status" text NOT NULL,
	"error" text,
	"decided_by" text,
	CONSTRAINT "import_row_status" CHECK ("import_row"."status" in ('ok', 'review', 'error', 'skipped')),
	CONSTRAINT "import_row_match_method" CHECK ("import_row"."match_method" is null or "import_row"."match_method" in ('alias', 'vat_id', 'duns', 'fuzzy', 'model', 'manual', 'new')),
	CONSTRAINT "import_row_category_method" CHECK ("import_row"."category_method" is null or "import_row"."category_method" in ('rule', 'model', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "supplier_alias" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"source_system" text DEFAULT 'erp' NOT NULL,
	"external_number" text,
	"name_variant" text,
	"created_from_row_id" uuid,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_alias_nummer" UNIQUE("org_id","source_system","external_number"),
	CONSTRAINT "supplier_alias_schluessel" CHECK ("supplier_alias"."external_number" is not null or "supplier_alias"."name_variant" is not null)
);
--> statement-breakpoint
ALTER TABLE "relationship_side" ADD COLUMN "parent_relationship_id" uuid;--> statement-breakpoint
ALTER TABLE "category_rule" ADD CONSTRAINT "category_rule_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rule" ADD CONSTRAINT "category_rule_material_group_id_material_group_id_fk" FOREIGN KEY ("material_group_id") REFERENCES "public"."material_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_row" ADD CONSTRAINT "import_row_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_row" ADD CONSTRAINT "import_row_batch_id_import_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_row" ADD CONSTRAINT "import_row_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_row" ADD CONSTRAINT "import_row_material_group_id_material_group_id_fk" FOREIGN KEY ("material_group_id") REFERENCES "public"."material_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_row" ADD CONSTRAINT "import_row_parent_relationship_id_relationship_id_fk" FOREIGN KEY ("parent_relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_alias" ADD CONSTRAINT "supplier_alias_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_alias" ADD CONSTRAINT "supplier_alias_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "import_batch_datei_einmal" ON "import_batch" USING btree ("org_id","file_hash") WHERE "import_batch"."status" = 'committed';--> statement-breakpoint
CREATE INDEX "import_batch_org" ON "import_batch" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "import_row_batch" ON "import_row" USING btree ("batch_id","status","row_no");--> statement-breakpoint
CREATE INDEX "supplier_alias_name" ON "supplier_alias" USING btree ("org_id","name_variant");--> statement-breakpoint
ALTER TABLE "relationship_side" ADD CONSTRAINT "relationship_side_parent_relationship_id_relationship_id_fk" FOREIGN KEY ("parent_relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
SELECT app_apply_layer('import_batch', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('import_row', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('supplier_alias', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('category_rule', 'org_private');
