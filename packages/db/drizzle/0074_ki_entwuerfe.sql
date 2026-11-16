CREATE TABLE "ai_draft" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"relationship_id" uuid,
	"kind" text NOT NULL,
	"object_type" text NOT NULL,
	"object_id" uuid NOT NULL,
	"subject" text,
	"content" text NOT NULL,
	"model" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	CONSTRAINT "ai_draft_kind" CHECK ("ai_draft"."kind" in ('deviation_explanation')),
	CONSTRAINT "ai_draft_status" CHECK ("ai_draft"."status" in ('draft', 'accepted', 'discarded'))
);
--> statement-breakpoint
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_draft_object" ON "ai_draft" USING btree ("org_id","kind","object_id");
SELECT app_apply_layer('ai_draft', 'org_private');