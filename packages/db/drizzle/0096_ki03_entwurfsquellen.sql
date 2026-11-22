ALTER TABLE "ai_source" DROP CONSTRAINT "ai_source_draft_id_ai_draft_id_fk";
--> statement-breakpoint
ALTER TABLE "ai_draft" ADD COLUMN "claims" jsonb;--> statement-breakpoint
ALTER TABLE "ai_draft" ADD COLUMN "run_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_draft" ADD COLUMN "edited" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_draft" ADD COLUMN "dismiss_reason" text;--> statement-breakpoint
ALTER TABLE "ai_source" ADD COLUMN "claim_key" text;--> statement-breakpoint
ALTER TABLE "ai_source" ADD COLUMN "object_type" text;--> statement-breakpoint
ALTER TABLE "ai_source" ADD COLUMN "object_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_source" ADD COLUMN "excerpt" text;--> statement-breakpoint
ALTER TABLE "ai_source" ADD CONSTRAINT "ai_source_draft_id_ai_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."ai_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_source_draft_claim" ON "ai_source" USING btree ("org_id","draft_id","claim_key");--> statement-breakpoint
ALTER TABLE "ai_source" ADD CONSTRAINT "ai_source_claim" CHECK ("ai_source"."claim_key" is null or ("ai_source"."draft_id" is not null and
        (("ai_source"."kind" = 'own_data' and "ai_source"."object_type" is not null and "ai_source"."object_id" is not null)
         or ("ai_source"."kind" = 'public' and "ai_source"."url" is not null))));
--> statement-breakpoint
-- Entwürfe mit Quellen gehören ausschließlich zur Käuferorganisation. Bestehende Entwürfe
-- haben keine belastbare Zuordnung je Aussage und behalten ihren bisherigen Leseweg.
CREATE POLICY ai_draft_buyer_claims ON ai_draft AS RESTRICTIVE FOR ALL TO reziproq_app
  USING (claims IS NULL OR EXISTS (
    SELECT 1 FROM organization_feature
    WHERE organization_id = ai_draft.org_id AND feature = 'buyer'
  ))
  WITH CHECK (claims IS NULL OR EXISTS (
    SELECT 1 FROM organization_feature
    WHERE organization_id = ai_draft.org_id AND feature = 'buyer'
  ));
--> statement-breakpoint
CREATE POLICY ai_source_claim_owner ON ai_source AS RESTRICTIVE FOR ALL TO reziproq_app
  USING (claim_key IS NULL OR EXISTS (
    SELECT 1 FROM ai_draft
    WHERE id = ai_source.draft_id AND org_id = ai_source.org_id AND claims IS NOT NULL
  ))
  WITH CHECK (claim_key IS NULL OR EXISTS (
    SELECT 1 FROM ai_draft
    WHERE id = ai_source.draft_id AND org_id = ai_source.org_id AND claims IS NOT NULL
  ));
