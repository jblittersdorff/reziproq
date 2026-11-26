-- ZQ-01 Regel 2, T2-ZQ2 (K2-a.2): gehalten nur mit Beleg. Zusagen, die vor ZQ-01 als gehalten
-- gebucht wurden, bekommen den Beleg „legacy“; neue Buchungen nennen Lieferavis, Wareneingang,
-- Dokument oder Bestätigung der anderen Seite.
UPDATE "commitment" SET "fulfilled_evidence" = '{"kind":"legacy"}'::jsonb
  WHERE "status" = 'kept' AND "fulfilled_evidence" IS NULL;--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_kept_evidence" CHECK ("commitment"."status" <> 'kept' or ("commitment"."fulfilled_evidence" is not null and jsonb_typeof("commitment"."fulfilled_evidence") = 'object' and "commitment"."fulfilled_evidence" ? 'kind'));