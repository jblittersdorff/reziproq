-- DM-01, KI-01 (K1-b.1): Den Modus der Modellantworten ändert nur ein Demo-Mandant für sich selbst.
-- Die App darf die Organisation nicht schreiben; die Funktion ändert genau ai_mode der Organisation
-- der Session und nur, wenn sie is_demo hat. Die Rechte (Admin) prüft die API vorher.
GRANT UPDATE (ai_mode) ON organization TO reziproq_stammdaten;--> statement-breakpoint
CREATE FUNCTION app_demo_modus_setzen(p_mode text) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  changed integer := 0;
BEGIN
  UPDATE organization SET ai_mode = p_mode
  WHERE id = nullif(current_setting('app.org_id', true), '')::uuid AND is_demo;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END
$$;--> statement-breakpoint
ALTER FUNCTION app_demo_modus_setzen(text) OWNER TO reziproq_stammdaten;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_demo_modus_setzen(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_demo_modus_setzen(text) TO reziproq_app;
