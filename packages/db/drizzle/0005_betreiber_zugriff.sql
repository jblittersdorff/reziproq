CREATE TABLE "betreiber_zugriff" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"nutzer_id" text NOT NULL,
	"organization_id" uuid,
	"aktion" text NOT NULL,
	"zeitpunkt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "betreiber_zugriff" ADD CONSTRAINT "betreiber_zugriff_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;