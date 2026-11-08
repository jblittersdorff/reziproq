CREATE TABLE "rating" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"criterion_key" text NOT NULL,
	"model_version" smallint NOT NULL,
	"ist" integer,
	"soll" integer,
	"comment" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	CONSTRAINT "rating_ist" CHECK ("rating"."ist" is null or "rating"."ist" between 0 and 100),
	CONSTRAINT "rating_soll" CHECK ("rating"."soll" is null or "rating"."soll" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "segmentation_round" ADD COLUMN "consolidated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rating" ADD CONSTRAINT "rating_assignment_id_rating_assignment_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."rating_assignment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating" ADD CONSTRAINT "rating_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rating_once" ON "rating" USING btree ("assignment_id","criterion_key");--> statement-breakpoint
CREATE INDEX "rating_relationship" ON "rating" USING btree ("relationship_id");
--> statement-breakpoint
SELECT app_apply_layer('rating', 'buyer_private');
--> statement-breakpoint
CREATE FUNCTION app_rating_round_open() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM rating_assignment a JOIN segmentation_round r ON r.id = a.round_id
    WHERE a.id = NEW.assignment_id AND r.status = 'closed'
  ) THEN
    RAISE EXCEPTION 'round_closed: Eine geschlossene Runde nimmt keine Bewertungen mehr an.';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER rating_round_open
  BEFORE INSERT OR UPDATE ON "rating"
  FOR EACH ROW EXECUTE FUNCTION app_rating_round_open();
