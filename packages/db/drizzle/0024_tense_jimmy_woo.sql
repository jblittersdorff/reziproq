CREATE TABLE "segment_decision" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"business_unit_id" uuid,
	"material_group_id" uuid,
	"ist_impact_level" smallint NOT NULL,
	"ist_quality_level" smallint NOT NULL,
	"soll_impact_level" smallint NOT NULL,
	"soll_quality_level" smallint NOT NULL,
	"reason" text NOT NULL,
	"model_version" smallint NOT NULL,
	"decided_by" text NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "segment_decision_scope" CHECK ("segment_decision"."scope" in ('total', 'bu_mg')),
	CONSTRAINT "segment_decision_target" CHECK (("segment_decision"."scope" = 'total' and "segment_decision"."business_unit_id" is null) or
        ("segment_decision"."scope" = 'bu_mg' and "segment_decision"."business_unit_id" is not null)),
	CONSTRAINT "segment_decision_levels" CHECK ("segment_decision"."ist_impact_level" between 1 and 3 and "segment_decision"."ist_quality_level" between 1 and 3
        and "segment_decision"."soll_impact_level" between 1 and 3 and "segment_decision"."soll_quality_level" between 1 and 3),
	CONSTRAINT "segment_decision_reason" CHECK (length(btrim("segment_decision"."reason")) > 0)
);
--> statement-breakpoint
ALTER TABLE "segment_decision" ADD CONSTRAINT "segment_decision_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_decision" ADD CONSTRAINT "segment_decision_business_unit_id_business_unit_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_decision" ADD CONSTRAINT "segment_decision_material_group_id_material_group_id_fk" FOREIGN KEY ("material_group_id") REFERENCES "public"."material_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segment_decision" ADD CONSTRAINT "segment_decision_decided_by_app_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "segment_decision_relationship" ON "segment_decision" USING btree ("relationship_id","version");--> statement-breakpoint
SELECT app_apply_layer('segment_decision', 'buyer_private');
--> statement-breakpoint
REVOKE UPDATE, DELETE ON "segment_decision" FROM reziproq_app;
