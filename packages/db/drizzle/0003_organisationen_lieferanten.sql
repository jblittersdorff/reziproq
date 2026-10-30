CREATE TYPE "public"."organization_typ" AS ENUM('kaeufer', 'lieferant');--> statement-breakpoint
CREATE TABLE "beziehung" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"kaeufer_org_id" uuid NOT NULL,
	"lieferant_org_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "beziehung_paar" UNIQUE("kaeufer_org_id","lieferant_org_id")
);
--> statement-breakpoint
CREATE TABLE "beziehung_kaeufer" (
	"beziehung_id" uuid PRIMARY KEY NOT NULL,
	"warengruppe" text NOT NULL,
	"jahresspend_cent" bigint NOT NULL,
	"spend_jahr" integer NOT NULL,
	"waehrung" text DEFAULT 'EUR' NOT NULL,
	CONSTRAINT "beziehung_kaeufer_spend_positiv" CHECK ("beziehung_kaeufer"."jahresspend_cent" >= 0),
	CONSTRAINT "beziehung_kaeufer_waehrung_iso" CHECK ("beziehung_kaeufer"."waehrung" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
-- Von Hand ergänzt: Bestehende Organisationen werden zu Käufern, damit die Migration
-- auch auf einer gefüllten Datenbank läuft. Danach gibt es keinen Standardwert mehr.
ALTER TABLE "organization" ADD COLUMN "typ" "organization_typ" NOT NULL DEFAULT 'kaeufer';--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "typ" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "land" text;--> statement-breakpoint
ALTER TABLE "beziehung" ADD CONSTRAINT "beziehung_kaeufer_org_id_organization_id_fk" FOREIGN KEY ("kaeufer_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beziehung" ADD CONSTRAINT "beziehung_lieferant_org_id_organization_id_fk" FOREIGN KEY ("lieferant_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "beziehung_kaeufer" ADD CONSTRAINT "beziehung_kaeufer_beziehung_id_beziehung_id_fk" FOREIGN KEY ("beziehung_id") REFERENCES "public"."beziehung"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_land_iso" CHECK ("organization"."land" ~ '^[A-Z]{2}$');