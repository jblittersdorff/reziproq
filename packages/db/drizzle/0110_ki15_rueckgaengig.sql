-- KI-15: Rückgängig machen eines Imports darf neu angelegte Lieferanten wieder entfernen. Die
-- Mandanten-Session löscht keine Beziehungen; diese eng gefasste Funktion entfernt nur eine Beziehung
-- im Entwurf, die ein übernommener Import desselben Käufers angelegt hat. Hängen schon andere Daten an
-- ihr, scheitert das Löschen an den Fremdschlüsseln.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reziproq_import') THEN
    CREATE ROLE reziproq_import NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint
GRANT reziproq_import TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_import;--> statement-breakpoint
GRANT SELECT ON import_batch TO reziproq_import;--> statement-breakpoint
GRANT SELECT, DELETE ON relationship, relationship_side TO reziproq_import;--> statement-breakpoint
CREATE POLICY import_batch_entfernen ON import_batch FOR SELECT TO reziproq_import USING (true);--> statement-breakpoint
CREATE POLICY relationship_import_entfernen ON relationship FOR ALL TO reziproq_import
  USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY relationship_side_import_entfernen ON relationship_side FOR ALL TO reziproq_import
  USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE FUNCTION app_import_beziehung_entfernen(p_relationship uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM relationship r
    WHERE r.id = p_relationship AND r.buyer_org_id = app_current_organization_id()
      AND r.status = 'draft'
  ) OR NOT EXISTS (
    SELECT 1 FROM import_batch b
    WHERE b.org_id = app_current_organization_id() AND b.status = 'committed'
      AND (b.undo -> 'relationships') ? p_relationship::text
  ) THEN
    RAISE EXCEPTION 'Nur Lieferanten aus einem eigenen Import' USING ERRCODE = 'insufficient_privilege';
  END IF;
  DELETE FROM relationship_side WHERE relationship_id = p_relationship;
  DELETE FROM relationship WHERE id = p_relationship;
END
$$;--> statement-breakpoint
ALTER FUNCTION app_import_beziehung_entfernen(uuid) OWNER TO reziproq_import;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_import_beziehung_entfernen(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_import_beziehung_entfernen(uuid) TO reziproq_app;
