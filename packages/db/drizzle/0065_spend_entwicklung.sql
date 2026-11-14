ALTER TABLE "relationship_spend" DROP CONSTRAINT "relationship_spend_je_jahr";--> statement-breakpoint
ALTER TABLE "relationship_spend" ADD COLUMN "kind" text DEFAULT 'actual' NOT NULL;--> statement-breakpoint
ALTER TABLE "relationship_spend" ADD COLUMN "business_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "relationship_spend" ADD COLUMN "material_group_id" uuid;--> statement-breakpoint
ALTER TABLE "relationship_spend" ADD CONSTRAINT "relationship_spend_business_unit_id_business_unit_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_spend" ADD CONSTRAINT "relationship_spend_material_group_id_material_group_id_fk" FOREIGN KEY ("material_group_id") REFERENCES "public"."material_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_spend" ADD CONSTRAINT "relationship_spend_je_eintrag" UNIQUE NULLS NOT DISTINCT("relationship_id","year","kind","business_unit_id","material_group_id");--> statement-breakpoint
ALTER TABLE "relationship_spend" ADD CONSTRAINT "relationship_spend_art" CHECK ("relationship_spend"."kind" in ('actual', 'plan'));--> statement-breakpoint
-- SPL-04: Ist-Spend je Lieferant und Jahr als Summe aller Zeilen (mit und ohne Aufteilung). Mit
-- security_invoker gilt Row-Level Security der lesenden Rolle wie bei der Tabelle selbst.
CREATE VIEW "relationship_spend_total" WITH (security_invoker = true) AS
  SELECT relationship_id, year, currency, sum(amount_cents)::bigint AS amount_cents
  FROM relationship_spend
  WHERE kind = 'actual'
  GROUP BY relationship_id, year, currency;--> statement-breakpoint
GRANT SELECT ON "relationship_spend_total" TO reziproq_app;
