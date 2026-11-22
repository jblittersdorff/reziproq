-- NAV-10: Notizen gehören der Käuferorganisation (org_private). Eine private Notiz sieht nur die
-- Person, die sie geschrieben hat, auch kein Admin. Die Notiz hängt an einer Beziehung, in der die
-- Organisation Käufer ist; schreiben darf man nur als man selbst.
SELECT app_apply_layer('note', 'org_private');--> statement-breakpoint
CREATE POLICY note_private_author ON note AS RESTRICTIVE FOR ALL TO reziproq_app
USING (visibility = 'team' OR author_user_id = app_current_user_id())
WITH CHECK (author_user_id = app_current_user_id());--> statement-breakpoint
CREATE FUNCTION app_note_owner() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  -- Fremde Zeilen lehnt danach Row-Level Security ab; hier nur die eigenen prüfen.
  IF NEW.org_id IS DISTINCT FROM app_current_organization_id() THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM relationship r WHERE r.id = NEW.relationship_id AND r.buyer_org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'foreign_entry: Notizen nur an eigenen Lieferanten';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER note_owner BEFORE INSERT OR UPDATE ON note
  FOR EACH ROW EXECUTE FUNCTION app_note_owner();
