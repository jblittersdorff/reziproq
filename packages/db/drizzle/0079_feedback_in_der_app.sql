-- Feedback in der App (Änderung zu PUL-02b, 16.11.2026): Wer eingeladen ist und ein Konto hat,
-- beantwortet den Fragebogen angemeldet in Reziproq statt über den Link. Die Einladungen bleiben
-- intern der einladenden Seite; deshalb finden drei enge Funktionen als reziproq_umfrage nur die
-- Einladungen der angemeldeten Person (gleiche E-Mail, eigene Organisation auf der eingeladenen
-- Seite). Antworten schreiben sie über dieselben Funktionen wie der Link: anonym, ein Bogen je
-- Einladung.
GRANT SELECT ("email") ON "survey_participant" TO reziproq_umfrage;--> statement-breakpoint
GRANT SELECT ("id", "email", "organization_id") ON "app_user" TO reziproq_umfrage;--> statement-breakpoint
CREATE POLICY app_user_umfrage ON "app_user" FOR SELECT TO reziproq_umfrage
  USING (id = app_current_user_id());--> statement-breakpoint

CREATE FUNCTION app_umfrage_meine()
RETURNS TABLE (participant_id uuid, token_hash text, wave_id uuid, relationship_id uuid,
  side text, kind text, due_date date, status text, buyer text, supplier text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT p.id, p.token_hash, w.id, r.id, p.side, w.kind, w.due_date,
      CASE
        WHEN p.completed_at IS NOT NULL THEN 'used'
        WHEN w.due_date < current_date OR r.status = 'ended'
          OR (p.side = 'buyer' AND w.buyer_closed_at IS NOT NULL)
          OR (p.side = 'supplier' AND w.supplier_closed_at IS NOT NULL) THEN 'expired'
        ELSE 'open'
      END,
      b.name, s.name
    FROM app_user u
    JOIN survey_participant p ON lower(p.email) = lower(u.email)
    JOIN survey_wave w ON w.id = p.wave_id
    JOIN relationship r ON r.id = w.relationship_id
    JOIN organization b ON b.id = r.buyer_org_id
    JOIN organization s ON s.id = r.supplier_org_id
    WHERE u.id = app_current_user_id()
      AND u.organization_id = app_current_organization_id()
      AND u.organization_id = CASE WHEN p.side = 'buyer' THEN r.buyer_org_id ELSE r.supplier_org_id END
    ORDER BY w.due_date, p.id
  $$;--> statement-breakpoint
ALTER FUNCTION app_umfrage_meine() OWNER TO reziproq_umfrage;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_umfrage_meine() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_umfrage_meine() TO reziproq_app;--> statement-breakpoint

-- Zustand und Fragen einer eigenen Einladung; leer, wenn sie nicht der angemeldeten Person gehört.
CREATE FUNCTION app_umfrage_teilnahme_lesen(p_participant uuid)
RETURNS TABLE (status text, kind text, due_date date, side text, buyer text, supplier text,
  questions jsonb)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT l.* FROM app_umfrage_meine() m, app_umfrage_lesen(m.token_hash) l
    WHERE m.participant_id = p_participant
  $$;--> statement-breakpoint
ALTER FUNCTION app_umfrage_teilnahme_lesen(uuid) OWNER TO reziproq_umfrage;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_umfrage_teilnahme_lesen(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_umfrage_teilnahme_lesen(uuid) TO reziproq_app;--> statement-breakpoint

-- Absenden einer eigenen Einladung; sonst survey_not_found. Prüfungen wie beim Link.
CREATE FUNCTION app_umfrage_teilnahme_absenden(p_participant uuid, p_answers jsonb, p_comment text)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_hash text;
BEGIN
  SELECT m.token_hash INTO v_hash FROM app_umfrage_meine() m WHERE m.participant_id = p_participant;
  IF v_hash IS NULL THEN RAISE EXCEPTION 'survey_not_found'; END IF;
  PERFORM app_umfrage_absenden(v_hash, p_answers, p_comment);
END;
$$;--> statement-breakpoint
ALTER FUNCTION app_umfrage_teilnahme_absenden(uuid, jsonb, text) OWNER TO reziproq_umfrage;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_umfrage_teilnahme_absenden(uuid, jsonb, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_umfrage_teilnahme_absenden(uuid, jsonb, text) TO reziproq_app;
