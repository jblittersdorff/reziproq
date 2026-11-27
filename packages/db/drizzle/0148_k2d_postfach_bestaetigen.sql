CREATE TABLE "confirm_credential" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"link_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"transports" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	CONSTRAINT "confirm_credential_id" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "confirm_link" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"contact_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"purpose" text DEFAULT 'commitment' NOT NULL,
	"object_ids" uuid[] NOT NULL,
	"source_mail_id" uuid,
	"token_hash" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"code_hash" text,
	"code_expires_at" timestamp with time zone,
	"code_attempts" integer DEFAULT 0 NOT NULL,
	"verified_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"result" text,
	"reason" text,
	CONSTRAINT "confirm_link_token_hash" UNIQUE("token_hash"),
	CONSTRAINT "confirm_link_purpose" CHECK ("confirm_link"."purpose" in ('commitment')),
	CONSTRAINT "confirm_link_result" CHECK ("confirm_link"."result" is null or "confirm_link"."result" in ('confirmed', 'declined')),
	CONSTRAINT "confirm_link_token_hash_form" CHECK ("confirm_link"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "confirm_link_code_hash_form" CHECK ("confirm_link"."code_hash" is null or "confirm_link"."code_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "confirm_link_objects" CHECK (cardinality("confirm_link"."object_ids") between 1 and 20),
	CONSTRAINT "confirm_link_used" CHECK (("confirm_link"."used_at" is null) = ("confirm_link"."result" is null)),
	CONSTRAINT "confirm_link_reason" CHECK ("confirm_link"."reason" is null or length("confirm_link"."reason") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "filed_mail" ADD COLUMN "assigned_by" text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "filed_mail" ADD COLUMN "assign_confidence" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "filed_mail" ADD COLUMN "extracted" jsonb;--> statement-breakpoint
ALTER TABLE "filed_mail" ADD COLUMN "reply_draft_id" uuid;--> statement-breakpoint
ALTER TABLE "confirm_credential" ADD CONSTRAINT "confirm_credential_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirm_credential" ADD CONSTRAINT "confirm_credential_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirm_credential" ADD CONSTRAINT "confirm_credential_link_id_confirm_link_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."confirm_link"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirm_link" ADD CONSTRAINT "confirm_link_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirm_link" ADD CONSTRAINT "confirm_link_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirm_link" ADD CONSTRAINT "confirm_link_contact_id_supplier_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."supplier_contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirm_link" ADD CONSTRAINT "confirm_link_source_mail_id_filed_mail_id_fk" FOREIGN KEY ("source_mail_id") REFERENCES "public"."filed_mail"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirm_link" ADD CONSTRAINT "confirm_link_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "confirm_credential_link" ON "confirm_credential" USING btree ("link_id");--> statement-breakpoint
CREATE INDEX "confirm_link_relationship" ON "confirm_link" USING btree ("relationship_id");--> statement-breakpoint
ALTER TABLE "filed_mail" ADD CONSTRAINT "filed_mail_assigned_by" CHECK ("filed_mail"."assigned_by" in ('reziproq', 'human'));--> statement-breakpoint
ALTER TABLE "filed_mail" ADD CONSTRAINT "filed_mail_confidence" CHECK ("filed_mail"."assign_confidence" is null or "filed_mail"."assign_confidence" between 0 and 1);--> statement-breakpoint
-- PO-01, BL-01 (K2-d.1): Bestätigungslinks und Passkeys gehören der Käuferseite, die den Link
-- erzeugt (org_private). Die Person beim Lieferanten liest ihren Link nur über die Funktionen
-- app_bestaetigen_* mit dem Token (K2-d.5); sie sieht nie andere Zeilen.
SELECT app_apply_layer('confirm_link', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('confirm_credential', 'org_private');
