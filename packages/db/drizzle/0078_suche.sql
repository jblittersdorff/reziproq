-- QS-05: Volltextsuche auf Lieferanten, Initiativen und Maßnahmen (Deutsch und Englisch). Die
-- Abfragen laufen über die Mandanten-Session und RLS; die Indizes beschleunigen nur.
CREATE INDEX "organization_suche_de" ON "organization" USING gin (to_tsvector('german', "name"));--> statement-breakpoint
CREATE INDEX "organization_suche_en" ON "organization" USING gin (to_tsvector('english', "name"));--> statement-breakpoint
CREATE INDEX "relationship_side_suche" ON "relationship_side" USING gin (to_tsvector('simple', coalesce("display_name", '') || ' ' || coalesce("external_ref", '')));--> statement-breakpoint
CREATE INDEX "initiative_suche_de" ON "initiative" USING gin (to_tsvector('german', "title" || ' ' || "goal"));--> statement-breakpoint
CREATE INDEX "initiative_suche_en" ON "initiative" USING gin (to_tsvector('english', "title" || ' ' || "goal"));--> statement-breakpoint
CREATE INDEX "action_suche_de" ON "action" USING gin (to_tsvector('german', "title"));--> statement-breakpoint
CREATE INDEX "action_suche_en" ON "action" USING gin (to_tsvector('english', "title"));
