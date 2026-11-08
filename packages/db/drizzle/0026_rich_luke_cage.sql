ALTER TABLE "relationship_side" ADD COLUMN "focus_set_by" text;--> statement-breakpoint
ALTER TABLE "relationship_side" ADD COLUMN "focus_set_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "segment_model" ADD COLUMN "focus_spend_share" smallint DEFAULT 80 NOT NULL;--> statement-breakpoint
ALTER TABLE "relationship_side" ADD CONSTRAINT "relationship_side_focus_set_by_app_user_id_fk" FOREIGN KEY ("focus_set_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_model" ADD CONSTRAINT "segment_model_focus_share" CHECK ("segment_model"."focus_spend_share" between 1 and 100);