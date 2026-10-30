-- Mandanten-Session und Row-Level Security (PLT-02, CLAUDE.md).
--
-- Die API verbindet sich als Eigentümer der Tabellen; Eigentümer und Superuser umgehen RLS.
-- Für Fachdaten wechselt sie deshalb in jeder Transaktion mit SET LOCAL ROLE auf reziproq_app
-- und setzt die Organisation als Sitzungswert (withTenant in packages/db/src/tenant.ts).
-- reziproq_app hat weder Login noch Sonderrechte, also gelten für sie alle Policies.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reziproq_app') THEN
    CREATE ROLE reziproq_app NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint

-- Damit auch ein Nutzer ohne Superuser-Rechte (z. B. auf AWS RDS) in die Rolle wechseln kann.
GRANT reziproq_app TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_app;--> statement-breakpoint
GRANT SELECT ON "organization", "beziehung", "beziehung_kaeufer" TO reziproq_app;--> statement-breakpoint

-- Die Organisation der laufenden Transaktion; NULL, wenn keine gesetzt ist.
CREATE OR REPLACE FUNCTION app_current_organization_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.organization_id', true), '')::uuid $$;--> statement-breakpoint

-- Beziehungen: Ein Käufer sieht nur seine eigenen.
ALTER TABLE "beziehung" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "beziehung_eigener_kaeufer" ON "beziehung"
  FOR SELECT TO reziproq_app
  USING ("kaeufer_org_id" = app_current_organization_id());--> statement-breakpoint

-- Käuferprivate Daten: nur zu Beziehungen des eigenen Käufers.
ALTER TABLE "beziehung_kaeufer" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "beziehung_kaeufer_eigener_kaeufer" ON "beziehung_kaeufer"
  FOR SELECT TO reziproq_app
  USING (EXISTS (
    SELECT 1 FROM "beziehung" b
    WHERE b."id" = "beziehung_kaeufer"."beziehung_id"
      AND b."kaeufer_org_id" = app_current_organization_id()
  ));--> statement-breakpoint

-- Organisationen: die eigene und die eigenen Lieferanten, nie andere Kunden.
ALTER TABLE "organization" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "organization_eigene_und_lieferanten" ON "organization"
  FOR SELECT TO reziproq_app
  USING (
    "id" = app_current_organization_id()
    OR EXISTS (
      SELECT 1 FROM "beziehung" b
      WHERE b."lieferant_org_id" = "organization"."id"
        AND b."kaeufer_org_id" = app_current_organization_id()
    )
  );
