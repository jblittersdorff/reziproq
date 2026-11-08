CREATE TABLE "cycle" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"label" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"jbp_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "cycle_status" CHECK ("cycle"."status" in ('active', 'closed'))
);
--> statement-breakpoint
ALTER TABLE "cycle" ADD CONSTRAINT "cycle_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cycle_relationship" ON "cycle" USING btree ("relationship_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cycle_one_active" ON "cycle" USING btree ("relationship_id") WHERE "cycle"."status" = 'active';
--> statement-breakpoint
SELECT app_apply_layer('cycle', 'buyer_private');