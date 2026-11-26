-- DM-01 (K1-g.4): Die Regie stellt den Modus der Modellantworten für alle Organisationen der Demo,
-- damit etwa Rheintal beim Abspielen mitläuft. Nur Demo-Mandanten; die Rechte (demo.regie) prüft
-- die API vorher. app_demo_modus_setzen (K1-b.1) bleibt für die eigene Organisation in den
-- KI-Einstellungen.
CREATE FUNCTION app_demo_modus_alle(p_mode text) RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  changed integer := 0;
BEGIN
  UPDATE organization SET ai_mode = p_mode WHERE id IN (SELECT app_demo_orgs()) AND is_demo;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_demo_modus_alle(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_demo_modus_alle(text) TO reziproq_app;
