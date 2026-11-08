CREATE TABLE "rating_assignment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"round_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"business_unit_id" uuid NOT NULL,
	"material_group_id" uuid,
	"function" text NOT NULL,
	"rater_user_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rating_assignment_status" CHECK ("rating_assignment"."status" in ('open', 'in_progress', 'submitted')),
	CONSTRAINT "rating_assignment_function" CHECK ("rating_assignment"."function" in ('purchasing', 'quality', 'engineering', 'logistics', 'programs', 'after_sales'))
);
--> statement-breakpoint
CREATE TABLE "segmentation_round" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"model_version" smallint,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "segmentation_round_status" CHECK ("segmentation_round"."status" in ('draft', 'open', 'closed')),
	CONSTRAINT "segmentation_round_model_version" CHECK (("segmentation_round"."status" = 'draft' and "segmentation_round"."model_version" is null) or
        ("segmentation_round"."status" in ('open', 'closed') and "segmentation_round"."model_version" > 0))
);
--> statement-breakpoint
ALTER TABLE "rating_assignment" ADD CONSTRAINT "rating_assignment_round_id_segmentation_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."segmentation_round"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_assignment" ADD CONSTRAINT "rating_assignment_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_assignment" ADD CONSTRAINT "rating_assignment_business_unit_id_business_unit_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_assignment" ADD CONSTRAINT "rating_assignment_material_group_id_material_group_id_fk" FOREIGN KEY ("material_group_id") REFERENCES "public"."material_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_assignment" ADD CONSTRAINT "rating_assignment_rater_user_id_app_user_id_fk" FOREIGN KEY ("rater_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segmentation_round" ADD CONSTRAINT "segmentation_round_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segmentation_round" ADD CONSTRAINT "segmentation_round_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rating_assignment_once" ON "rating_assignment" USING btree ("round_id","relationship_id","business_unit_id",coalesce("material_group_id", '00000000-0000-0000-0000-000000000000'::uuid),"function");--> statement-breakpoint
CREATE INDEX "rating_assignment_rater" ON "rating_assignment" USING btree ("rater_user_id");--> statement-breakpoint
CREATE INDEX "rating_assignment_round" ON "rating_assignment" USING btree ("round_id");--> statement-breakpoint
CREATE INDEX "segmentation_round_org" ON "segmentation_round" USING btree ("org_id");--> statement-breakpoint
SELECT app_apply_layer('segmentation_round', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('rating_assignment', 'buyer_private');
--> statement-breakpoint
CREATE FUNCTION app_rating_assignment_round_open() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM segmentation_round WHERE id = NEW.round_id AND status = 'closed') THEN
    RAISE EXCEPTION 'round_closed: Eine geschlossene Runde nimmt keine Bewertungen mehr an.';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER rating_assignment_round_open
  BEFORE INSERT OR UPDATE ON "rating_assignment"
  FOR EACH ROW EXECUTE FUNCTION app_rating_assignment_round_open();
