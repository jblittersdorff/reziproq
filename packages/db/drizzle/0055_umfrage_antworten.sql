CREATE TABLE "survey_response" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"wave_id" uuid NOT NULL,
	"side" text NOT NULL,
	"function" text NOT NULL,
	"answers" jsonb NOT NULL,
	"comment" text,
	CONSTRAINT "survey_response_side" CHECK ("survey_response"."side" in ('buyer', 'supplier')),
	CONSTRAINT "survey_response_answers_object" CHECK (jsonb_typeof("survey_response"."answers") = 'object'),
	CONSTRAINT "survey_response_comment" CHECK ("survey_response"."comment" is null or length("survey_response"."comment") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "survey_response" ADD CONSTRAINT "survey_response_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_response" ADD CONSTRAINT "survey_response_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_response" ADD CONSTRAINT "survey_response_wave_id_survey_wave_id_fk" FOREIGN KEY ("wave_id") REFERENCES "public"."survey_wave"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "survey_response_wave" ON "survey_response" USING btree ("wave_id");--> statement-breakpoint
SELECT app_apply_layer('survey_response', 'org_private');--> statement-breakpoint
-- PUL-02b: Antworten sind nur anfügbar; die App liest sie nur auf der eigenen Seite (PUL-03).
REVOKE UPDATE, DELETE ON "survey_response" FROM reziproq_app;--> statement-breakpoint
-- Beantworten ohne Anmeldung: zwei Funktionen als reziproq_umfrage, ausführbar nur für
-- reziproq_api. Der Token erreicht die Datenbank nie, nur sein SHA-256.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'reziproq_umfrage') THEN
    CREATE ROLE reziproq_umfrage NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint
GRANT reziproq_umfrage TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_umfrage;--> statement-breakpoint
GRANT SELECT ("id", "wave_id", "relationship_id", "side", "function", "token_hash", "completed_at")
  ON "survey_participant" TO reziproq_umfrage;--> statement-breakpoint
GRANT UPDATE ("completed_at") ON "survey_participant" TO reziproq_umfrage;--> statement-breakpoint
GRANT SELECT ("id", "relationship_id", "template_id", "kind", "due_date", "buyer_closed_at",
  "supplier_closed_at") ON "survey_wave" TO reziproq_umfrage;--> statement-breakpoint
GRANT SELECT ("id", "questions") ON "survey_template" TO reziproq_umfrage;--> statement-breakpoint
GRANT SELECT ("id", "buyer_org_id", "supplier_org_id", "status") ON "relationship" TO reziproq_umfrage;--> statement-breakpoint
GRANT SELECT ("id", "name") ON "organization" TO reziproq_umfrage;--> statement-breakpoint
GRANT INSERT ON "survey_response" TO reziproq_umfrage;--> statement-breakpoint
CREATE POLICY survey_participant_umfrage ON "survey_participant" FOR ALL TO reziproq_umfrage USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY survey_wave_umfrage ON "survey_wave" FOR SELECT TO reziproq_umfrage USING (true);--> statement-breakpoint
CREATE POLICY survey_template_umfrage ON "survey_template" FOR SELECT TO reziproq_umfrage USING (true);--> statement-breakpoint
CREATE POLICY relationship_umfrage ON "relationship" FOR SELECT TO reziproq_umfrage USING (true);--> statement-breakpoint
CREATE POLICY organization_umfrage ON "organization" FOR SELECT TO reziproq_umfrage USING (true);--> statement-breakpoint
CREATE POLICY survey_response_umfrage ON "survey_response" FOR INSERT TO reziproq_umfrage WITH CHECK (true);--> statement-breakpoint
-- Zustand eines Links und die aktiven Fragen seiner Version. Gültig bis einschließlich Frist,
-- solange die eigene Seite nicht abgeschlossen hat und die Beziehung nicht beendet ist.
CREATE FUNCTION app_umfrage_lesen(p_token_hash text)
RETURNS TABLE (status text, kind text, due_date date, side text, buyer text, supplier text,
  questions jsonb)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT
      CASE
        WHEN p.completed_at IS NOT NULL THEN 'used'
        WHEN w.due_date < current_date OR r.status = 'ended'
          OR (p.side = 'buyer' AND w.buyer_closed_at IS NOT NULL)
          OR (p.side = 'supplier' AND w.supplier_closed_at IS NOT NULL) THEN 'expired'
        ELSE 'open'
      END,
      w.kind, w.due_date, p.side, b.name, s.name,
      (SELECT coalesce(jsonb_agg(q), '[]'::jsonb) FROM jsonb_array_elements(t.questions) q
        WHERE (q->>'active')::boolean)
    FROM survey_participant p
    JOIN survey_wave w ON w.id = p.wave_id
    JOIN survey_template t ON t.id = w.template_id
    JOIN relationship r ON r.id = w.relationship_id
    JOIN organization b ON b.id = r.buyer_org_id
    JOIN organization s ON s.id = r.supplier_org_id
    WHERE p.token_hash = p_token_hash
  $$;--> statement-breakpoint
ALTER FUNCTION app_umfrage_lesen(text) OWNER TO reziproq_umfrage;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_umfrage_lesen(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_umfrage_lesen(text) TO reziproq_api;--> statement-breakpoint
-- Genau ein Antwortbogen je Link. Jede aktive Frage braucht Ist und Soll (1–5 oder null für
-- „Kann ich nicht beurteilen“). Fehler als Text: survey_not_found, survey_used, survey_expired,
-- survey_answers_invalid.
CREATE FUNCTION app_umfrage_absenden(p_token_hash text, p_answers jsonb, p_comment text)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  part survey_participant%ROWTYPE;
  v_wave survey_wave%ROWTYPE;
  v_rel relationship%ROWTYPE;
  v_questions jsonb;
  v_keys text[];
  v_key text;
  v_value jsonb;
BEGIN
  SELECT * INTO part FROM survey_participant p WHERE p.token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'survey_not_found'; END IF;
  IF part.completed_at IS NOT NULL THEN RAISE EXCEPTION 'survey_used'; END IF;
  SELECT * INTO v_wave FROM survey_wave w WHERE w.id = part.wave_id;
  SELECT * INTO v_rel FROM relationship r WHERE r.id = v_wave.relationship_id;
  IF v_wave.due_date < current_date OR v_rel.status = 'ended'
    OR (part.side = 'buyer' AND v_wave.buyer_closed_at IS NOT NULL)
    OR (part.side = 'supplier' AND v_wave.supplier_closed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'survey_expired';
  END IF;
  SELECT t.questions INTO v_questions FROM survey_template t WHERE t.id = v_wave.template_id;
  SELECT coalesce(array_agg(q->>'key' ORDER BY q->>'key'), '{}') INTO v_keys
    FROM jsonb_array_elements(v_questions) q WHERE (q->>'active')::boolean;
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object'
    OR (SELECT coalesce(array_agg(k ORDER BY k), '{}') FROM jsonb_object_keys(p_answers) k) <> v_keys
    OR (p_comment IS NOT NULL AND length(p_comment) > 2000) THEN
    RAISE EXCEPTION 'survey_answers_invalid';
  END IF;
  FOREACH v_key IN ARRAY v_keys LOOP
    v_value := p_answers->v_key;
    IF jsonb_typeof(v_value) <> 'object'
      OR NOT (v_value ? 'current' AND v_value ? 'target')
      OR (SELECT count(*) FROM jsonb_object_keys(v_value)) <> 2
      OR NOT (jsonb_typeof(v_value->'current') = 'null'
        OR (jsonb_typeof(v_value->'current') = 'number' AND (v_value->>'current')::numeric IN (1, 2, 3, 4, 5)))
      OR NOT (jsonb_typeof(v_value->'target') = 'null'
        OR (jsonb_typeof(v_value->'target') = 'number' AND (v_value->>'target')::numeric IN (1, 2, 3, 4, 5))) THEN
      RAISE EXCEPTION 'survey_answers_invalid';
    END IF;
  END LOOP;
  INSERT INTO survey_response (org_id, relationship_id, wave_id, side, function, answers, comment)
  VALUES (
    CASE WHEN part.side = 'buyer' THEN v_rel.buyer_org_id ELSE v_rel.supplier_org_id END,
    v_rel.id, v_wave.id, part.side, part.function, p_answers, nullif(trim(p_comment), '')
  );
  UPDATE survey_participant SET completed_at = now() WHERE id = part.id;
END;
$$;--> statement-breakpoint
ALTER FUNCTION app_umfrage_absenden(text, jsonb, text) OWNER TO reziproq_umfrage;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_umfrage_absenden(text, jsonb, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_umfrage_absenden(text, jsonb, text) TO reziproq_api;
