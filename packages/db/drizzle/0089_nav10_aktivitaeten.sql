CREATE TABLE "note" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"author_user_id" text NOT NULL,
	"visibility" text NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_visibility" CHECK ("note"."visibility" in ('team','private')),
	CONSTRAINT "note_kind" CHECK ("note"."kind" in ('note','call'))
);
--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_author_user_id_app_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "note_relationship_date" ON "note" USING btree ("relationship_id","created_at");