CREATE TABLE "cycle_reminder_sent" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"cycle_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"step" text NOT NULL,
	"due_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cycle_reminder_sent_je_faelligkeit" UNIQUE("cycle_id","step","due_date")
);
--> statement-breakpoint
CREATE TABLE "cycle_setting" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"step" text NOT NULL,
	"weeks_relative_to_jbp" integer NOT NULL,
	"reminder_days_before" integer DEFAULT 7 NOT NULL,
	CONSTRAINT "cycle_setting_je_schritt" UNIQUE("org_id","step"),
	CONSTRAINT "cycle_setting_step" CHECK ("cycle_setting"."step" in ('feedback', 'touchpoints', 'supplierPlan', 'jbp', 'scorecard')),
	CONSTRAINT "cycle_setting_wochen" CHECK ("cycle_setting"."weeks_relative_to_jbp" between -104 and 104),
	CONSTRAINT "cycle_setting_erinnerung" CHECK ("cycle_setting"."reminder_days_before" between 0 and 365)
);
--> statement-breakpoint
ALTER TABLE "cycle_reminder_sent" ADD CONSTRAINT "cycle_reminder_sent_cycle_id_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_reminder_sent" ADD CONSTRAINT "cycle_reminder_sent_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_setting" ADD CONSTRAINT "cycle_setting_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
SELECT app_apply_layer('cycle_setting', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('cycle_reminder_sent', 'buyer_private');