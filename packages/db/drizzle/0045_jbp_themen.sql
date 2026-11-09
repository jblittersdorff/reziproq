CREATE TABLE "jbp_topic" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"jbp_id" uuid NOT NULL,
	"side" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"priority" integer NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"park_reason" text,
	"created_by" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jbp_topic_side" CHECK ("jbp_topic"."side" in ('buyer', 'supplier')),
	CONSTRAINT "jbp_topic_status" CHECK ("jbp_topic"."status" in ('proposed', 'merged', 'parked')),
	CONSTRAINT "jbp_topic_title" CHECK (length(trim("jbp_topic"."title")) between 1 and 200),
	CONSTRAINT "jbp_topic_description" CHECK (length("jbp_topic"."description") <= 2000),
	CONSTRAINT "jbp_topic_priority" CHECK ("jbp_topic"."priority" > 0),
	CONSTRAINT "jbp_topic_park_reason" CHECK ("jbp_topic"."status" <> 'parked' or length(trim(coalesce("jbp_topic"."park_reason", ''))) > 0)
);
--> statement-breakpoint
CREATE TABLE "jbp_topic_origin" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"jbp_topic_id" uuid NOT NULL,
	"strategic_topic_id" uuid NOT NULL,
	CONSTRAINT "jbp_topic_origin_once" UNIQUE("jbp_topic_id")
);
--> statement-breakpoint
ALTER TABLE "jbp_topic" ADD CONSTRAINT "jbp_topic_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jbp_topic" ADD CONSTRAINT "jbp_topic_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jbp_topic" ADD CONSTRAINT "jbp_topic_jbp_id_jbp_id_fk" FOREIGN KEY ("jbp_id") REFERENCES "public"."jbp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jbp_topic_origin" ADD CONSTRAINT "jbp_topic_origin_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jbp_topic_origin" ADD CONSTRAINT "jbp_topic_origin_jbp_topic_id_jbp_topic_id_fk" FOREIGN KEY ("jbp_topic_id") REFERENCES "public"."jbp_topic"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jbp_topic_origin" ADD CONSTRAINT "jbp_topic_origin_strategic_topic_id_strategic_topic_id_fk" FOREIGN KEY ("strategic_topic_id") REFERENCES "public"."strategic_topic"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jbp_topic_jbp" ON "jbp_topic" USING btree ("jbp_id","side","priority");--> statement-breakpoint
SELECT app_apply_layer('jbp_topic', 'shared');--> statement-breakpoint
SELECT app_apply_layer('jbp_topic_origin', 'buyer_private');
