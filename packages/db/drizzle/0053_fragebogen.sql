CREATE TABLE "survey_template" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"version" integer NOT NULL,
	"questions" jsonb NOT NULL,
	"created_by" text,
	"created_by_name" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_template_version" UNIQUE("org_id","kind","version"),
	CONSTRAINT "survey_template_kind" CHECK ("survey_template"."kind" in ('pulse', 'annual')),
	CONSTRAINT "survey_template_version_positive" CHECK ("survey_template"."version" >= 1),
	CONSTRAINT "survey_template_questions_array" CHECK (jsonb_typeof("survey_template"."questions") = 'array')
);
--> statement-breakpoint
ALTER TABLE "survey_template" ADD CONSTRAINT "survey_template_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
SELECT app_apply_layer('survey_template', 'org_private');--> statement-breakpoint
-- PUL-01: Versionen sind nur anfügbar; eine Änderung legt eine neue Version an.
REVOKE UPDATE, DELETE ON "survey_template" FROM reziproq_app;
