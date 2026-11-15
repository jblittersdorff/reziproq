DROP INDEX "initiative_share_je_initiative";--> statement-breakpoint
CREATE INDEX "initiative_share_initiative" ON "initiative_share" USING btree ("initiative_id");