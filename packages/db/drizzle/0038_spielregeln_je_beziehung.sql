CREATE TABLE "rule_set" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"target_impact_level" smallint NOT NULL,
	"target_quality_level" smallint NOT NULL,
	"type_name" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_by" text,
	"approved_by_name" text,
	"approved_at" timestamp with time zone,
	CONSTRAINT "rule_set_version" UNIQUE("relationship_id","version"),
	CONSTRAINT "rule_set_status" CHECK ("rule_set"."status" in ('draft', 'approved', 'shared')),
	CONSTRAINT "rule_set_levels" CHECK ("rule_set"."target_impact_level" between 1 and 3 and "rule_set"."target_quality_level" between 1 and 3),
	CONSTRAINT "rule_set_approved" CHECK (("rule_set"."status" = 'draft') = ("rule_set"."approved_at" IS NULL AND "rule_set"."approved_by" IS NULL AND "rule_set"."approved_by_name" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "rule_set_item" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"rule_set_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"kind" text NOT NULL,
	"group" text,
	"title" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"cadence" text,
	"level" text,
	"origin" text NOT NULL,
	"catalog_item_id" uuid,
	"position" integer NOT NULL,
	CONSTRAINT "rule_set_item_kind" CHECK ("rule_set_item"."kind" in ('right', 'obligation', 'format')),
	CONSTRAINT "rule_set_item_origin" CHECK ("rule_set_item"."origin" in ('catalog', 'custom')),
	CONSTRAINT "rule_set_item_catalog" CHECK (("rule_set_item"."origin" = 'catalog') = ("rule_set_item"."catalog_item_id" IS NOT NULL)),
	CONSTRAINT "rule_set_item_shape" CHECK (("rule_set_item"."kind" = 'format') = ("rule_set_item"."group" IS NULL AND "rule_set_item"."cadence" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "rule_set_note" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"rule_set_id" uuid NOT NULL,
	"rule_set_item_id" uuid,
	"catalog_item_id" uuid,
	"removed_item" jsonb,
	"deviation_reason" text NOT NULL,
	CONSTRAINT "rule_set_note_target" CHECK (("rule_set_note"."rule_set_item_id" IS NULL) <> ("rule_set_note"."catalog_item_id" IS NULL)),
	CONSTRAINT "rule_set_note_reason" CHECK (length(trim("rule_set_note"."deviation_reason")) between 3 and 1000)
);
--> statement-breakpoint
ALTER TABLE "rule_set" ADD CONSTRAINT "rule_set_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_set" ADD CONSTRAINT "rule_set_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_set_item" ADD CONSTRAINT "rule_set_item_rule_set_id_rule_set_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."rule_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_set_item" ADD CONSTRAINT "rule_set_item_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_set_item" ADD CONSTRAINT "rule_set_item_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_set_note" ADD CONSTRAINT "rule_set_note_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_set_note" ADD CONSTRAINT "rule_set_note_rule_set_id_rule_set_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."rule_set"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_set_note" ADD CONSTRAINT "rule_set_note_rule_set_item_id_rule_set_item_id_fk" FOREIGN KEY ("rule_set_item_id") REFERENCES "public"."rule_set_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rule_set_item_set" ON "rule_set_item" USING btree ("rule_set_id");--> statement-breakpoint
CREATE INDEX "rule_set_note_set" ON "rule_set_note" USING btree ("rule_set_id");--> statement-breakpoint
-- PLB-03: Spielregeln sind geteilt angelegt, aber intern, bis SEG-10 sie teilt.
SELECT app_apply_layer('rule_set', 'shared');--> statement-breakpoint
SELECT app_apply_layer('rule_set_item', 'shared');--> statement-breakpoint
SELECT app_apply_layer('rule_set_note', 'buyer_private');
