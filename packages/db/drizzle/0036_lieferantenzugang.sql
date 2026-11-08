-- LIF-02: Die Kunden eines Lieferanten. Ohne Kundenkontext sieht die Lieferantenseite keine
-- Beziehung (PLT-04); für die Kundenliste und die Wahl des Kontexts genügen ID der Beziehung und
-- des Käufers, nur aktive Beziehungen und nur die eigene Organisation als Lieferant. Namen liest
-- die API über die Policy organization_global.
CREATE FUNCTION app_meine_kunden()
RETURNS TABLE (relationship_id uuid, buyer_org_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT r.id, r.buyer_org_id FROM relationship r
    WHERE r.supplier_org_id = app_current_organization_id() AND r.status = 'active'
  $$;--> statement-breakpoint
ALTER FUNCTION app_meine_kunden() OWNER TO reziproq_ebenen;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_meine_kunden() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_meine_kunden() TO reziproq_app;
