-- PUL-02b: app_umfrage_absenden liest nur die Spalten, die reziproq_umfrage sehen darf.
CREATE OR REPLACE FUNCTION app_umfrage_absenden(p_token_hash text, p_answers jsonb, p_comment text)
RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_participant uuid;
  v_side text;
  v_function text;
  v_completed timestamptz;
  v_wave uuid;
  v_template uuid;
  v_due date;
  v_buyer_closed timestamptz;
  v_supplier_closed timestamptz;
  v_relationship uuid;
  v_buyer uuid;
  v_supplier uuid;
  v_status text;
  v_keys text[];
  v_key text;
  v_value jsonb;
BEGIN
  SELECT p.id, p.side, p.function, p.completed_at, p.wave_id
    INTO v_participant, v_side, v_function, v_completed, v_wave
    FROM survey_participant p WHERE p.token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'survey_not_found'; END IF;
  IF v_completed IS NOT NULL THEN RAISE EXCEPTION 'survey_used'; END IF;
  SELECT w.template_id, w.due_date, w.buyer_closed_at, w.supplier_closed_at, w.relationship_id
    INTO v_template, v_due, v_buyer_closed, v_supplier_closed, v_relationship
    FROM survey_wave w WHERE w.id = v_wave;
  SELECT r.buyer_org_id, r.supplier_org_id, r.status INTO v_buyer, v_supplier, v_status
    FROM relationship r WHERE r.id = v_relationship;
  IF v_due < current_date OR v_status = 'ended'
    OR (v_side = 'buyer' AND v_buyer_closed IS NOT NULL)
    OR (v_side = 'supplier' AND v_supplier_closed IS NOT NULL) THEN
    RAISE EXCEPTION 'survey_expired';
  END IF;
  SELECT coalesce(array_agg(q->>'key' ORDER BY q->>'key'), '{}') INTO v_keys
    FROM survey_template t, jsonb_array_elements(t.questions) q
    WHERE t.id = v_template AND (q->>'active')::boolean;
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
    CASE WHEN v_side = 'buyer' THEN v_buyer ELSE v_supplier END,
    v_relationship, v_wave, v_side, v_function, p_answers, nullif(trim(p_comment), '')
  );
  UPDATE survey_participant SET completed_at = now() WHERE id = v_participant;
END;
$$;
