CREATE TABLE "relationship_target" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"type_name" text NOT NULL,
	"type_description" text NOT NULL,
	"rule_set_id" uuid NOT NULL,
	"rule_set_version" integer NOT NULL,
	"shared_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shared_by" text NOT NULL,
	"shared_by_name" text NOT NULL,
	CONSTRAINT "relationship_target_relationship" UNIQUE("relationship_id","owner_org_id","visibility")
);
--> statement-breakpoint
ALTER TABLE "relationship_target" ADD CONSTRAINT "relationship_target_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_target" ADD CONSTRAINT "relationship_target_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_target" ADD CONSTRAINT "relationship_target_rule_set_id_rule_set_id_fk" FOREIGN KEY ("rule_set_id") REFERENCES "public"."rule_set"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- SEG-10: Der geteilte Beziehungstyp ist eine geteilte Tabelle; die Zeile trägt visibility shared.
SELECT app_apply_layer('relationship_target', 'shared');
