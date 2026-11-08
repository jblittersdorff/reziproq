CREATE TABLE "segment_criterion" (
	"model_id" uuid NOT NULL,
	"axis" text NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"weight" numeric(5, 2) NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "segment_criterion_key" UNIQUE("model_id","key"),
	CONSTRAINT "segment_criterion_position_unique" UNIQUE("model_id","axis","position"),
	CONSTRAINT "segment_criterion_axis" CHECK ("segment_criterion"."axis" in ('impact', 'quality')),
	CONSTRAINT "segment_criterion_weight" CHECK ("segment_criterion"."weight" >= 0 and "segment_criterion"."weight" <= 100),
	CONSTRAINT "segment_criterion_position" CHECK ("segment_criterion"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "segment_model" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"version" smallint NOT NULL,
	"status" text NOT NULL,
	"low_max" smallint NOT NULL,
	"mid_max" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone,
	CONSTRAINT "segment_model_org_version" UNIQUE("org_id","version"),
	CONSTRAINT "segment_model_status" CHECK ("segment_model"."status" in ('draft', 'active', 'retired')),
	CONSTRAINT "segment_model_boundaries" CHECK ("segment_model"."low_max" >= 0 and "segment_model"."low_max" < "segment_model"."mid_max" and "segment_model"."mid_max" <= 100),
	CONSTRAINT "segment_model_version" CHECK ("segment_model"."version" > 0),
	CONSTRAINT "segment_model_activation" CHECK (("segment_model"."status" = 'draft' and "segment_model"."activated_at" is null) or
        ("segment_model"."status" in ('active', 'retired') and "segment_model"."activated_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "segment_type" (
	"model_id" uuid NOT NULL,
	"impact_level" smallint NOT NULL,
	"quality_level" smallint NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	CONSTRAINT "segment_type_cell" UNIQUE("model_id","impact_level","quality_level"),
	CONSTRAINT "segment_type_levels" CHECK ("segment_type"."impact_level" between 1 and 3 and "segment_type"."quality_level" between 1 and 3)
);
--> statement-breakpoint
ALTER TABLE "segment_criterion" ADD CONSTRAINT "segment_criterion_model_id_segment_model_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."segment_model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_model" ADD CONSTRAINT "segment_model_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_type" ADD CONSTRAINT "segment_type_model_id_segment_model_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."segment_model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "segment_criterion_model" ON "segment_criterion" USING btree ("model_id");--> statement-breakpoint
CREATE UNIQUE INDEX "segment_model_one_active" ON "segment_model" USING btree ("org_id") WHERE "segment_model"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "segment_model_one_draft" ON "segment_model" USING btree ("org_id") WHERE "segment_model"."status" = 'draft';--> statement-breakpoint
CREATE INDEX "segment_type_model" ON "segment_type" USING btree ("model_id");
--> statement-breakpoint
SELECT app_apply_layer('segment_model', 'org_private');
--> statement-breakpoint
ALTER TABLE "segment_criterion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "segment_criterion" FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON "segment_criterion" TO reziproq_app;
CREATE POLICY "segment_criterion_model_org" ON "segment_criterion" FOR ALL TO reziproq_app
  USING (EXISTS (SELECT 1 FROM "segment_model" model WHERE model.id = model_id))
  WITH CHECK (EXISTS (SELECT 1 FROM "segment_model" model WHERE model.id = model_id));
REVOKE DELETE ON "segment_criterion" FROM reziproq_app;
--> statement-breakpoint
ALTER TABLE "segment_type" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "segment_type" FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON "segment_type" TO reziproq_app;
CREATE POLICY "segment_type_model_org" ON "segment_type" FOR ALL TO reziproq_app
  USING (EXISTS (SELECT 1 FROM "segment_model" model WHERE model.id = model_id))
  WITH CHECK (EXISTS (SELECT 1 FROM "segment_model" model WHERE model.id = model_id));
REVOKE DELETE ON "segment_type" FROM reziproq_app;
--> statement-breakpoint
CREATE FUNCTION app_segment_weights_sum() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  target_model uuid := coalesce(NEW.model_id, OLD.model_id);
BEGIN
  IF EXISTS (
    SELECT axis
    FROM segment_criterion
    WHERE model_id = target_model
    GROUP BY axis
    HAVING sum(weight) <> 100
  ) THEN
    RAISE EXCEPTION 'segment_weights_invalid: Gewichte je Achse müssen 100 ergeben.';
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER segment_criterion_weight_sum
  AFTER INSERT OR UPDATE OR DELETE ON "segment_criterion"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION app_segment_weights_sum();