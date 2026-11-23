CREATE TABLE "material_group_conflict" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"rule_key" text NOT NULL,
	"fingerprint" text NOT NULL,
	"material_group_ids" uuid[] NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"note" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_group_conflict_once" UNIQUE("relationship_id","rule_key","fingerprint"),
	CONSTRAINT "material_group_conflict_rule" CHECK ("material_group_conflict"."rule_key" in ('phase_out_vs_growth', 'relationship_mixed', 'concentration', 'award_vs_target')),
	CONSTRAINT "material_group_conflict_status" CHECK ("material_group_conflict"."status" in ('open', 'aligned', 'accepted')),
	CONSTRAINT "material_group_conflict_note" CHECK ("material_group_conflict"."status" = 'open' or length(trim(coalesce("material_group_conflict"."note", ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "material_group_conflict" ADD CONSTRAINT "material_group_conflict_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_conflict" ADD CONSTRAINT "material_group_conflict_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_conflict" ADD CONSTRAINT "material_group_conflict_decided_by_app_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_group_conflict_relationship" ON "material_group_conflict" USING btree ("relationship_id","status");--> statement-breakpoint
SELECT app_apply_layer('material_group_conflict', 'org_private');
