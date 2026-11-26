ALTER TABLE "segment_model" ADD COLUMN "grid_size" smallint DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "segment_model" ADD COLUMN "impact_label" text DEFAULT 'Business Impact' NOT NULL;--> statement-breakpoint
ALTER TABLE "segment_model" ADD COLUMN "quality_label" text DEFAULT 'Beziehungsqualität' NOT NULL;--> statement-breakpoint
ALTER TABLE "segment_model" ADD CONSTRAINT "segment_model_grid_size" CHECK ("segment_model"."grid_size" in (2, 3));--> statement-breakpoint
ALTER TABLE "segment_model" ADD CONSTRAINT "segment_model_grid_boundaries" CHECK ("segment_model"."grid_size" = 3 or "segment_model"."mid_max" = 100);--> statement-breakpoint
ALTER TABLE "segment_model" ADD CONSTRAINT "segment_model_axis_labels" CHECK (length(trim("segment_model"."impact_label")) between 1 and 80 and length(trim("segment_model"."quality_label")) between 1 and 80);--> statement-breakpoint
-- E-K0-33 (K2-b.1): Ein anderes Raster legt die Typen des Entwurfs neu an. Löschen darf die App nur
-- Typen eines Entwurfs; aktive und abgelöste Modelle bleiben, wie sie sind (0021 entzog das Recht).
GRANT DELETE ON "segment_type" TO reziproq_app;--> statement-breakpoint
CREATE POLICY "segment_type_delete_draft" ON "segment_type" AS RESTRICTIVE FOR DELETE TO reziproq_app
  USING (EXISTS (SELECT 1 FROM "segment_model" model WHERE model.id = model_id AND model.status = 'draft'));
