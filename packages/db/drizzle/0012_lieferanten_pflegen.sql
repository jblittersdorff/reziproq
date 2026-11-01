-- PLT-03b: Lieferanten anlegen, ändern und beenden.
--
-- Ein Lieferant existiert in Reziproq nur einmal. Beim Anlegen sucht die Datenbank eine
-- Organisation mit derselben USt-IdNr. oder D-U-N-S-Nummer, über alle Kunden hinweg. Das darf
-- die Mandanten-Session nicht selbst; dafür gibt es zwei eng gefasste Funktionen, die nie Name
-- oder Land einer fremden Organisation zurückgeben.

-- 1. Rolle für die Stammdaten-Funktionen ------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reziproq_stammdaten') THEN
    CREATE ROLE reziproq_stammdaten NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint

GRANT reziproq_stammdaten TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_stammdaten;--> statement-breakpoint
GRANT SELECT, INSERT ON "organization" TO reziproq_stammdaten;--> statement-breakpoint
GRANT SELECT ON "organization_feature" TO reziproq_stammdaten;--> statement-breakpoint
CREATE POLICY "organization_stammdaten" ON "organization"
  FOR ALL TO reziproq_stammdaten USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "organization_feature_stammdaten" ON "organization_feature"
  FOR SELECT TO reziproq_stammdaten USING (true);--> statement-breakpoint

-- Nur Organisationen mit Käuferfunktionen legen Lieferanten an (PLT-02).
CREATE FUNCTION app_ist_kaeufer() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM organization_feature f
      WHERE f.organization_id = app_current_organization_id() AND f.feature = 'buyer'
    )
  $$;--> statement-breakpoint

-- Gibt es schon eine Organisation mit dieser USt-IdNr. oder D-U-N-S? Nur ja oder nein.
CREATE FUNCTION app_lieferant_bekannt(p_vat_id text, p_duns text) RETURNS boolean
  LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
BEGIN
  IF NOT app_ist_kaeufer() THEN
    RAISE EXCEPTION 'Nur Käufer suchen Lieferanten' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM organization o
    WHERE o.id <> app_current_organization_id()
      AND ((p_vat_id IS NOT NULL AND o.vat_id = p_vat_id)
        OR (p_duns IS NOT NULL AND o.duns = p_duns))
  );
END
$$;--> statement-breakpoint

-- Sucht die Organisation über USt-IdNr. (zuerst) oder D-U-N-S und legt sonst eine neue ohne
-- Nutzer an. Gibt nur die ID zurück und ob sie schon bestand.
CREATE FUNCTION app_lieferant_finden_oder_anlegen(
  p_name text, p_country text, p_vat_id text, p_duns text
) RETURNS TABLE (id uuid, existed boolean)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  found uuid;
BEGIN
  IF NOT app_ist_kaeufer() THEN
    RAISE EXCEPTION 'Nur Käufer legen Lieferanten an' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_vat_id IS NOT NULL THEN
    SELECT o.id INTO found FROM organization o WHERE o.vat_id = p_vat_id;
  END IF;
  IF found IS NULL AND p_duns IS NOT NULL THEN
    SELECT o.id INTO found FROM organization o WHERE o.duns = p_duns;
  END IF;
  IF found = app_current_organization_id() THEN
    RAISE EXCEPTION 'Die eigene Organisation ist kein Lieferant' USING ERRCODE = 'check_violation';
  END IF;
  IF found IS NOT NULL THEN
    RETURN QUERY SELECT found, true;
    RETURN;
  END IF;
  RETURN QUERY
    INSERT INTO organization (name, country, vat_id, duns)
    VALUES (p_name, p_country, p_vat_id, p_duns)
    RETURNING organization.id, false;
END
$$;--> statement-breakpoint

ALTER FUNCTION app_ist_kaeufer() OWNER TO reziproq_stammdaten;--> statement-breakpoint
ALTER FUNCTION app_lieferant_bekannt(text, text) OWNER TO reziproq_stammdaten;--> statement-breakpoint
ALTER FUNCTION app_lieferant_finden_oder_anlegen(text, text, text, text) OWNER TO reziproq_stammdaten;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_ist_kaeufer(), app_lieferant_bekannt(text, text),
  app_lieferant_finden_oder_anlegen(text, text, text, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_ist_kaeufer(), app_lieferant_bekannt(text, text),
  app_lieferant_finden_oder_anlegen(text, text, text, text) TO reziproq_app;--> statement-breakpoint

-- 2. Beziehungen anlegen und ändern: nur als Käufer der Beziehung ------------------------------
--
-- Neue Beziehungen beginnen als Entwurf; aktiv werden sie erst mit der Einladung (LIF-01).

GRANT INSERT, UPDATE ON "relationship" TO reziproq_app;--> statement-breakpoint
CREATE POLICY "relationship_anlegen" ON "relationship"
  FOR INSERT TO reziproq_app
  WITH CHECK ("buyer_org_id" = app_current_organization_id() AND "status" = 'draft');--> statement-breakpoint
CREATE POLICY "relationship_aendern" ON "relationship"
  FOR UPDATE TO reziproq_app
  USING ("buyer_org_id" = app_current_organization_id())
  WITH CHECK ("buyer_org_id" = app_current_organization_id());
