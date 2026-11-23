CREATE TABLE "addin_registration" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"organizer_email" text NOT NULL,
	"subject" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"relationship_id" uuid,
	"meeting_type" text NOT NULL,
	"brief_opt_in" boolean DEFAULT true NOT NULL,
	"transcript_opt_in" boolean DEFAULT false NOT NULL,
	"insert_agenda" boolean DEFAULT false NOT NULL,
	"event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"matched_meeting_id" uuid
);
--> statement-breakpoint
CREATE TABLE "inbound_item" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text DEFAULT 'meeting' NOT NULL,
	"source" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"from_email" text,
	"subject" text NOT NULL,
	"ical_uid" text,
	"sequence" integer DEFAULT 0 NOT NULL,
	"details" jsonb NOT NULL,
	"suggested_relationship_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggestion_kind" text NOT NULL,
	"suggestion_reason" text,
	"suggested_type" text DEFAULT 'other' NOT NULL,
	"status" text NOT NULL,
	"owner_user_id" text,
	"assignee_user_id" text,
	"assigned_by" text,
	"assigned_at" timestamp with time zone,
	"object_type" text,
	"object_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"registration_id" uuid,
	CONSTRAINT "inbound_item_status" CHECK ("inbound_item"."status" in ('auto_assigned', 'needs_review', 'assigned', 'ignored', 'rejected')),
	CONSTRAINT "inbound_item_source" CHECK ("inbound_item"."source" in ('outlook_addin', 'inbound_mail', 'calendar_sync'))
);
--> statement-breakpoint
CREATE TABLE "meeting_attendee" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"meeting_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"side" text NOT NULL,
	"user_id" text,
	"supplier_contact_id" uuid,
	"response" text,
	CONSTRAINT "meeting_attendee_side" CHECK ("meeting_attendee"."side" in ('buyer', 'supplier', 'unknown'))
);
--> statement-breakpoint
CREATE TABLE "supplier_domain" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"source" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_domain_eindeutig" UNIQUE("org_id","relationship_id","domain"),
	CONSTRAINT "supplier_domain_source" CHECK ("supplier_domain"."source" in ('contact', 'manual', 'learned'))
);
--> statement-breakpoint
ALTER TABLE "meeting" DROP CONSTRAINT "meeting_status";--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "source" text DEFAULT 'reziproq' NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "ical_uid" text;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "external_ids" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "organizer_email" text;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "sequence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "online_meeting_url" text;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "transcript_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "brief_opt_in" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "insert_agenda" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "addin_registration" ADD CONSTRAINT "addin_registration_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addin_registration" ADD CONSTRAINT "addin_registration_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_item" ADD CONSTRAINT "inbound_item_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_attendee" ADD CONSTRAINT "meeting_attendee_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_attendee" ADD CONSTRAINT "meeting_attendee_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_domain" ADD CONSTRAINT "supplier_domain_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_domain" ADD CONSTRAINT "supplier_domain_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addin_registration_match" ON "addin_registration" USING btree ("org_id","organizer_email","start_at");--> statement-breakpoint
CREATE INDEX "inbound_item_org" ON "inbound_item" USING btree ("org_id","status","received_at");--> statement-breakpoint
CREATE INDEX "inbound_item_uid" ON "inbound_item" USING btree ("org_id","ical_uid");--> statement-breakpoint
CREATE INDEX "meeting_attendee_meeting" ON "meeting_attendee" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "supplier_domain_domain" ON "supplier_domain" USING btree ("org_id","domain");--> statement-breakpoint
CREATE INDEX "meeting_ical_uid" ON "meeting" USING btree ("owner_org_id","ical_uid");--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_source" CHECK ("meeting"."source" in ('reziproq', 'outlook_addin', 'inbound_mail', 'calendar_sync'));--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_status" CHECK ("meeting"."status" in ('planned', 'held', 'closed', 'cancelled'));--> statement-breakpoint
SELECT app_apply_layer('meeting_attendee', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('supplier_domain', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('inbound_item', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('addin_registration', 'org_private');
