-- B-39, E-K2-11 (Entscheidung des Gründers am 27.11.2026): Die Läufe nach Zeitplan, die die Regie
-- auch selbst startet (Hinweise, Triage, Briefings, Wertfinder), gehen nicht mehr über
-- Demo-Mandanten. Deren Läufe startet nur die Regie („Neuer Tag“), mit eigener Liste der
-- Organisationen. Eigentümer und Rechte der Funktion bleiben.
CREATE OR REPLACE FUNCTION app_hint_orgs()
  RETURNS TABLE (org_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
  SELECT DISTINCT r.buyer_org_id FROM relationship r
  WHERE r.status = 'active' AND NOT app_org_is_demo(r.buyer_org_id)
  ORDER BY 1
$$;
