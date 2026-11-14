CREATE TABLE "role_description" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"role" text NOT NULL,
	"does" jsonb NOT NULL,
	"does_not" jsonb NOT NULL,
	"updated_by" text NOT NULL,
	"updated_by_name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_description_role" UNIQUE("org_id","role"),
	CONSTRAINT "role_description_lists" CHECK (jsonb_typeof("role_description"."does") = 'array' and jsonb_typeof("role_description"."does_not") = 'array')
);
--> statement-breakpoint
ALTER TABLE "role_description" ADD CONSTRAINT "role_description_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
SELECT app_apply_layer('role_description', 'org_private');
