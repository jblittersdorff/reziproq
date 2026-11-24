ALTER TABLE "focus_item" DROP CONSTRAINT "focus_item_relationship_id_relationship_id_fk";
--> statement-breakpoint
ALTER TABLE "focus_item" ADD COLUMN "href" text;--> statement-breakpoint
ALTER TABLE "segment_type" ADD COLUMN "triage_weight" numeric(4, 2) DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "focus_item" ADD CONSTRAINT "focus_item_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_item" ADD CONSTRAINT "focus_item_href" CHECK ("focus_item"."href" is null or left("focus_item"."href", 1) = '/');--> statement-breakpoint
ALTER TABLE "segment_type" ADD CONSTRAINT "segment_type_triage_weight" CHECK ("segment_type"."triage_weight" between 0.1 and 10);
--> statement-breakpoint

-- Handteil K1-c (HE-01 Triage).

-- 1. E-K0-17: Der strategische Typ jedes Modells (höchste Wirkung, beste Beziehung) startet mit
--    dem Gewicht 2,0, alle anderen mit 1,0.
UPDATE segment_type t SET triage_weight = 2
WHERE t.impact_level = (SELECT max(x.impact_level) FROM segment_type x WHERE x.model_id = t.model_id)
  AND t.quality_level = (SELECT max(x.quality_level) FROM segment_type x WHERE x.model_id = t.model_id);--> statement-breakpoint

-- 2. next_action (HE-01, NAV-10): offene Fokus-Themen nach der Uhr je Mandant (DM-01). Ein
--    „Später“ zählt wieder, sobald seine Zeit vorbei ist. Neu angelegt, damit die Sicht auch die
--    Spalte href enthält. Rechte wie focus_item (security_invoker).
DROP VIEW next_action;--> statement-breakpoint
CREATE VIEW next_action WITH (security_invoker = true) AS
  SELECT f.*
  FROM focus_item f
  WHERE f.level = 'focus'
    AND (f.state = 'open' OR (f.state = 'snoozed' AND f.snoozed_until <= app_now()));--> statement-breakpoint
GRANT SELECT ON next_action TO reziproq_app;
