-- DM-01, E-K0-05 (K1-b.2): Personen der Demo-Mandanten für die Demo-Sitzung je Person. Nur Personen
-- aus Organisationen mit is_demo; andere Mandanten liefert die Funktion nie. Die API ruft sie nur,
-- wenn Demo-Sitzungen in der lokalen Konfiguration erlaubt sind (nie in Produktion).
CREATE FUNCTION app_demo_personen()
  RETURNS TABLE (id text, name text, org_id uuid, org_name text, org_role text, buyer boolean)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT u.id, u.name, o.id, o.name, u.org_role,
      EXISTS (SELECT 1 FROM organization_feature f
              WHERE f.organization_id = o.id AND f.feature = 'buyer')
    FROM app_user u JOIN organization o ON o.id = u.organization_id
    WHERE o.is_demo
    ORDER BY o.name, u.name
  $$;--> statement-breakpoint
ALTER FUNCTION app_demo_personen() OWNER TO reziproq_anmeldung;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_demo_personen() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_demo_personen() TO reziproq_api;
