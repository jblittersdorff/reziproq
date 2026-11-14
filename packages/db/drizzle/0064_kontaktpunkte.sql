CREATE TABLE "touchpoint" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"buyer_user_id" text,
	"buyer_name" text NOT NULL,
	"buyer_level" text NOT NULL,
	"supplier_contact_id" uuid,
	"supplier_name" text NOT NULL,
	"supplier_level" text NOT NULL,
	"format" text NOT NULL,
	"cadence" text NOT NULL,
	"notes" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "touchpoint_levels" CHECK ("touchpoint"."buyer_level" in ('executive', 'management', 'operational') and "touchpoint"."supplier_level" in ('executive', 'management', 'operational')),
	CONSTRAINT "touchpoint_cadence" CHECK ("touchpoint"."cadence" in ('monthly', 'quarterly', 'semiannual', 'annual', 'on_demand')),
	CONSTRAINT "touchpoint_contact_internal" CHECK ("touchpoint"."visibility" = 'internal' or "touchpoint"."supplier_contact_id" is null),
	CONSTRAINT "touchpoint_texts" CHECK (length(trim("touchpoint"."buyer_name")) between 1 and 120 and length(trim("touchpoint"."supplier_name")) between 1 and 120 and length(trim("touchpoint"."format")) between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "touchpoint_review" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	"reviewed_by" text NOT NULL,
	"reviewed_by_name" text NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "touchpoint_review_je_zyklus" UNIQUE("cycle_id")
);
--> statement-breakpoint
ALTER TABLE "touchpoint" ADD CONSTRAINT "touchpoint_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "touchpoint" ADD CONSTRAINT "touchpoint_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "touchpoint_review" ADD CONSTRAINT "touchpoint_review_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "touchpoint_review" ADD CONSTRAINT "touchpoint_review_cycle_id_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "touchpoint_relationship" ON "touchpoint" USING btree ("relationship_id");--> statement-breakpoint
SELECT app_apply_layer('touchpoint', 'shared');--> statement-breakpoint
SELECT app_apply_layer('touchpoint_review', 'buyer_private');--> statement-breakpoint
-- Geprüft bleibt geprüft.
REVOKE UPDATE, DELETE ON "touchpoint_review" FROM reziproq_app;
