CREATE TABLE "jbp" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"meeting_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jbp_status" CHECK ("jbp"."status" in ('draft', 'in_review', 'approved')),
	CONSTRAINT "jbp_version" CHECK ("jbp"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "jbp_business_update" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"jbp_id" uuid NOT NULL,
	"side" text NOT NULL,
	"text" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jbp_business_update_per_side" UNIQUE("jbp_id","owner_org_id","visibility"),
	CONSTRAINT "jbp_business_update_side" CHECK ("jbp_business_update"."side" in ('buyer', 'supplier')),
	CONSTRAINT "jbp_business_update_text" CHECK (length("jbp_business_update"."text") <= 10000)
);
--> statement-breakpoint
CREATE TABLE "jbp_cycle_link" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"jbp_id" uuid NOT NULL,
	"cycle_id" uuid NOT NULL,
	CONSTRAINT "jbp_cycle_link_once" UNIQUE("jbp_id")
);
--> statement-breakpoint
ALTER TABLE "jbp" ADD CONSTRAINT "jbp_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jbp" ADD CONSTRAINT "jbp_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jbp" ADD CONSTRAINT "jbp_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jbp_business_update" ADD CONSTRAINT "jbp_business_update_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jbp_business_update" ADD CONSTRAINT "jbp_business_update_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jbp_business_update" ADD CONSTRAINT "jbp_business_update_jbp_id_jbp_id_fk" FOREIGN KEY ("jbp_id") REFERENCES "public"."jbp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jbp_cycle_link" ADD CONSTRAINT "jbp_cycle_link_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jbp_cycle_link" ADD CONSTRAINT "jbp_cycle_link_jbp_id_jbp_id_fk" FOREIGN KEY ("jbp_id") REFERENCES "public"."jbp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jbp_cycle_link" ADD CONSTRAINT "jbp_cycle_link_cycle_id_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jbp_relationship" ON "jbp" USING btree ("relationship_id","version");--> statement-breakpoint
SELECT app_apply_layer('jbp', 'shared');--> statement-breakpoint
SELECT app_apply_layer('jbp_cycle_link', 'buyer_private');--> statement-breakpoint
SELECT app_apply_layer('jbp_business_update', 'shared');
