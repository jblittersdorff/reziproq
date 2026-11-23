CREATE TABLE "org_module" (
	"org_id" uuid NOT NULL,
	"module" text NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_module_org_id_module_pk" PRIMARY KEY("org_id","module"),
	CONSTRAINT "org_module_module" CHECK ("org_module"."module" in ('claims', 'risk', 'contract', 'value_finder', 'category_strategy'))
);
--> statement-breakpoint
ALTER TABLE "org_module" ADD CONSTRAINT "org_module_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- UX-20: Module je Organisation. Die App liest nur die eigene Organisation; umschalten nur der
-- Betrieb (Gründer, 23.11.2026), deshalb keine Schreibrechte für die App.
ALTER TABLE "org_module" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "org_module" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT ON "org_module" TO reziproq_app;--> statement-breakpoint
CREATE POLICY "org_module_eigene" ON "org_module"
  FOR SELECT TO reziproq_app
  USING ("org_id" = app_current_organization_id());
