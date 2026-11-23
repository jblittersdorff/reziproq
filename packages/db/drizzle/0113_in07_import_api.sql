CREATE TABLE "spend_period" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"period" text NOT NULL,
	"material_group_id" uuid,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"source" text DEFAULT 'api' NOT NULL,
	"delivery_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	CONSTRAINT "spend_period_format" CHECK ("spend_period"."period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "spend_period_positiv" CHECK ("spend_period"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "api_key" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"hash" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_key_hash" UNIQUE("hash")
);
--> statement-breakpoint
DROP INDEX "import_batch_datei_einmal";--> statement-breakpoint
ALTER TABLE "import_batch" ADD COLUMN "source" text DEFAULT 'file' NOT NULL;--> statement-breakpoint
ALTER TABLE "import_batch" ADD COLUMN "api_key_id" uuid;--> statement-breakpoint
ALTER TABLE "import_batch" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "import_batch" ADD COLUMN "api_response" jsonb;--> statement-breakpoint
ALTER TABLE "import_batch" ADD COLUMN "api_errors" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "import_batch" ADD COLUMN "ignored_fields" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "import_batch" ADD COLUMN "delivery_id" uuid;--> statement-breakpoint
ALTER TABLE "spend_period" ADD CONSTRAINT "spend_period_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spend_period" ADD CONSTRAINT "spend_period_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spend_period" ADD CONSTRAINT "spend_period_material_group_id_material_group_id_fk" FOREIGN KEY ("material_group_id") REFERENCES "public"."material_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spend_period" ADD CONSTRAINT "spend_period_batch_id_import_batch_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spend_period_org" ON "spend_period" USING btree ("org_id","source","period");--> statement-breakpoint
CREATE INDEX "spend_period_relationship" ON "spend_period" USING btree ("relationship_id","period");--> statement-breakpoint
CREATE INDEX "api_key_org" ON "api_key" USING btree ("org_id");--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_api_key_id_api_key_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_key"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_batch_idempotency" ON "import_batch" USING btree ("org_id","api_key_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "import_batch_datei_einmal" ON "import_batch" USING btree ("org_id","file_hash") WHERE "import_batch"."status" = 'committed' and "import_batch"."source" = 'file';--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_source" CHECK ("import_batch"."source" in ('file', 'api'));--> statement-breakpoint
SELECT app_apply_layer('api_key', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('spend_period', 'org_private');--> statement-breakpoint

-- IN-07: Ein Aufruf der Import-API kennt nur seinen Schlüssel. Die Funktion nennt zum Hash nur
-- Organisation, Schlüssel, erlaubte Objektarten, Widerruf und die Person, die ihn erzeugt hat; sie
-- läuft als die enge Rolle der Webhook-Suche aus 0111, die dafür nur diese Spalten lesen darf.
GRANT SELECT ("id", "org_id", "hash", "scopes", "created_by", "revoked_at") ON "api_key" TO reziproq_hook_lookup;--> statement-breakpoint
CREATE POLICY api_key_lookup ON "api_key" FOR SELECT TO reziproq_hook_lookup USING (true);--> statement-breakpoint
CREATE FUNCTION app_api_key(p_hash text)
  RETURNS TABLE (id uuid, org_id uuid, scopes jsonb, created_by text, revoked_at timestamptz)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
  SELECT k.id, k.org_id, k.scopes, k.created_by, k.revoked_at FROM api_key k WHERE k.hash = p_hash
$$;--> statement-breakpoint
ALTER FUNCTION app_api_key(text) OWNER TO reziproq_hook_lookup;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_api_key(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_api_key(text) TO reziproq_api;
