ALTER TABLE "segment_decision" DROP CONSTRAINT "segment_decision_scope";--> statement-breakpoint
ALTER TABLE "segment_decision" DROP CONSTRAINT "segment_decision_target";--> statement-breakpoint
ALTER TABLE "segment_decision" ADD COLUMN "origin" text DEFAULT 'round' NOT NULL;--> statement-breakpoint
ALTER TABLE "segmentation_round" ADD COLUMN "scope" text DEFAULT 'portfolio' NOT NULL;--> statement-breakpoint
ALTER TABLE "segmentation_round" ADD COLUMN "material_group_id" uuid;--> statement-breakpoint
ALTER TABLE "segmentation_round" ADD CONSTRAINT "segmentation_round_material_group_id_material_group_id_fk" FOREIGN KEY ("material_group_id") REFERENCES "public"."material_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "segment_decision_category_version" ON "segment_decision" USING btree ("relationship_id","material_group_id","version") WHERE "segment_decision"."scope" = 'category';--> statement-breakpoint
ALTER TABLE "segment_decision" ADD CONSTRAINT "segment_decision_origin" CHECK ("segment_decision"."origin" in ('round', 'manual', 'merged'));--> statement-breakpoint
ALTER TABLE "segment_decision" ADD CONSTRAINT "segment_decision_scope" CHECK ("segment_decision"."scope" in ('total', 'bu_mg', 'category'));--> statement-breakpoint
ALTER TABLE "segment_decision" ADD CONSTRAINT "segment_decision_target" CHECK (("segment_decision"."scope" = 'total' and "segment_decision"."business_unit_id" is null) or
        ("segment_decision"."scope" = 'bu_mg' and "segment_decision"."business_unit_id" is not null) or
        ("segment_decision"."scope" = 'category' and "segment_decision"."business_unit_id" is null and "segment_decision"."material_group_id" is not null));--> statement-breakpoint
ALTER TABLE "segmentation_round" ADD CONSTRAINT "segmentation_round_scope" CHECK (("segmentation_round"."scope" = 'portfolio' and "segmentation_round"."material_group_id" is null) or
        ("segmentation_round"."scope" = 'category' and "segmentation_round"."material_group_id" is not null));