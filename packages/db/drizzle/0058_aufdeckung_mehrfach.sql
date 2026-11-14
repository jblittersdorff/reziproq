-- PUL-03: app_survey_reveal darf in einer Transaktion mehrere Wellen aufdecken.
CREATE OR REPLACE FUNCTION app_survey_reveal(p_wave_id uuid) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_relationship uuid;
  v_template uuid;
  v_due date;
  v_buyer_closed timestamptz;
  v_supplier_closed timestamptz;
  v_revealed timestamptz;
  v_owner uuid;
BEGIN
  SELECT w.relationship_id, w.template_id, w.due_date, w.buyer_closed_at, w.supplier_closed_at,
    w.revealed_at
    INTO v_relationship, v_template, v_due, v_buyer_closed, v_supplier_closed, v_revealed
    FROM survey_wave w WHERE w.id = p_wave_id FOR UPDATE;
  IF v_relationship IS NULL OR NOT app_is_relationship_party(v_relationship) THEN
    RAISE EXCEPTION 'wave_not_found';
  END IF;
  IF v_revealed IS NOT NULL THEN RETURN true; END IF;
  IF NOT ((v_buyer_closed IS NOT NULL AND v_supplier_closed IS NOT NULL) OR v_due < current_date) THEN
    RETURN false;
  END IF;
  IF (SELECT count(*) FROM survey_response r WHERE r.wave_id = p_wave_id AND r.side = 'buyer') < 3
    OR (SELECT count(*) FROM survey_response r WHERE r.wave_id = p_wave_id AND r.side = 'supplier') < 3 THEN
    RETURN false;
  END IF;
  SELECT r.buyer_org_id INTO v_owner FROM relationship r WHERE r.id = v_relationship;

  -- Mehrere Aufdeckungen in einer Transaktion: die Hilfstabelle der vorigen zuerst entfernen.
  DROP TABLE IF EXISTS pg_temp.survey_answer;
  CREATE TEMP TABLE survey_answer ON COMMIT DROP AS
    SELECT r.id AS rid, r.side, r.function AS fn, q->>'key' AS qkey, q->>'dimension' AS dim,
      q->>'textDe' AS label_de, q->>'textEn' AS label_en,
      (r.answers->(q->>'key')->>'current')::numeric AS ist,
      (r.answers->(q->>'key')->>'target')::numeric AS soll
    FROM survey_response r
    JOIN survey_template t ON t.id = v_template
    CROSS JOIN LATERAL jsonb_array_elements(t.questions) q
    WHERE r.wave_id = p_wave_id AND (q->>'active')::boolean;

  -- Gesamt je Seite: Dimension und Frage.
  INSERT INTO survey_result (wave_id, relationship_id, owner_org_id, visibility, side, function,
    dimension, question_key, label_de, label_en, ist_mean, soll_mean, n)
  SELECT p_wave_id, v_relationship, v_owner, 'shared', a.side, NULL, a.dim, NULL, NULL, NULL,
    round(avg(a.ist), 2), round(avg(a.soll), 2), count(DISTINCT a.rid)
  FROM survey_answer a GROUP BY a.side, a.dim;
  INSERT INTO survey_result (wave_id, relationship_id, owner_org_id, visibility, side, function,
    dimension, question_key, label_de, label_en, ist_mean, soll_mean, n)
  SELECT p_wave_id, v_relationship, v_owner, 'shared', a.side, NULL, a.dim, a.qkey,
    min(a.label_de), min(a.label_en), round(avg(a.ist), 2), round(avg(a.soll), 2),
    count(DISTINCT a.rid)
  FROM survey_answer a GROUP BY a.side, a.dim, a.qkey;
  -- Je Funktion nur Gruppen ab drei Antworten, nur Dimensionen.
  INSERT INTO survey_result (wave_id, relationship_id, owner_org_id, visibility, side, function,
    dimension, question_key, label_de, label_en, ist_mean, soll_mean, n)
  SELECT p_wave_id, v_relationship, v_owner, 'shared', a.side, a.fn, a.dim, NULL, NULL, NULL,
    round(avg(a.ist), 2), round(avg(a.soll), 2), count(DISTINCT a.rid)
  FROM survey_answer a
  WHERE (SELECT count(*) FROM survey_response r
    WHERE r.wave_id = p_wave_id AND r.side = a.side AND r.function = a.fn) >= 3
  GROUP BY a.side, a.fn, a.dim;
  -- Freitexte ohne Funktion, in zufälliger Reihenfolge.
  INSERT INTO survey_free_text (wave_id, relationship_id, owner_org_id, visibility, side, text, position)
  SELECT p_wave_id, v_relationship, v_owner, 'shared', r.side, r.comment,
    row_number() OVER (ORDER BY random())
  FROM survey_response r WHERE r.wave_id = p_wave_id AND r.comment IS NOT NULL;

  UPDATE survey_wave SET revealed_at = now() WHERE id = p_wave_id;
  RETURN true;
END;
$$;
