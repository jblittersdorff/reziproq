-- K1-a.2 (DM-01, E-K0-14 Reihenfolge): Uhr je Mandant. Alle Dienste lesen die Zeit über eine
-- Funktion je Mandant; im Demo-Mandanten liefert sie organization.demo_now, sonst now().
-- Ohne Mandanten-Session (Anmeldung, Links ohne Konto, Jobs ohne Organisation) gilt die Echtzeit.
-- Eigentümer ist reziproq_stammdaten, das Organisationen lesen darf (0012). Ausführen darf jede
-- Rolle (Standard für Funktionen), weil Standardwerte von Spalten app_now() aufrufen.

CREATE FUNCTION app_org_demo_now(p_org uuid) RETURNS timestamptz
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT o.demo_now FROM organization o WHERE o.id = p_org AND o.is_demo
  $$;--> statement-breakpoint
ALTER FUNCTION app_org_demo_now(uuid) OWNER TO reziproq_stammdaten;--> statement-breakpoint

-- Demo-Uhr der Organisation der Session, sonst null
CREATE FUNCTION app_demo_now() RETURNS timestamptz
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT app_org_demo_now(nullif(current_setting('app.org_id', true), '')::uuid)
  $$;--> statement-breakpoint
ALTER FUNCTION app_demo_now() OWNER TO reziproq_stammdaten;--> statement-breakpoint

-- Fachzeit der Session: Demo-Uhr oder now()
CREATE FUNCTION app_now() RETURNS timestamptz
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT coalesce(app_demo_now(), now())
  $$;--> statement-breakpoint
ALTER FUNCTION app_now() OWNER TO reziproq_stammdaten;--> statement-breakpoint

-- Fach-Funktionen mit app_now() statt now() und current_date. Bewusst auf Echtzeit bleiben die
-- Funktionen ohne Mandanten-Session: app_nutzer_synchronisieren und app_sprache_setzen
-- (Anmeldung), app_einladung_lesen und app_einladung_annehmen (Einladung per Link),
-- app_umfrage_lesen und app_umfrage_absenden (Umfrage per Link). BL-01 baut die Links neu (K2-d).

-- app_confirm_owner_side: letzte Fassung aus 0130_k1a_datenraeume.sql, Uhr je Mandant (K1-a.2)
CREATE OR REPLACE FUNCTION app_confirm_owner_side() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  side text;
BEGIN
  IF NEW.visibility <> 'shared' OR NEW.confirm_state <> 'draft' THEN
    RETURN NEW;
  END IF;
  side := app_row_space('org_private', NEW.relationship_id, NEW.owner_org_id, NULL);
  IF side = 'buyer_private' THEN
    NEW.confirm_state := 'buyer_confirmed';
    NEW.buyer_confirmed_by := nullif(current_setting('app.user_id', true), '');
    NEW.buyer_confirmed_at := app_now();
  ELSIF side = 'supplier_private' THEN
    NEW.confirm_state := 'supplier_confirmed';
    NEW.supplier_confirmed_by := nullif(current_setting('app.user_id', true), '');
    NEW.supplier_confirmed_at := app_now();
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint

-- app_guard_shared: letzte Fassung aus 0130_k1a_datenraeume.sql, Uhr je Mandant (K1-a.2)
CREATE OR REPLACE FUNCTION app_guard_shared() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  run text := nullif(current_setting('app.run_id', true), '');
  token text := nullif(current_setting('app.confirm_token', true), '');
  used integer := 0;
BEGIN
  IF NEW.visibility <> 'shared' OR run IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.visibility = 'shared' THEN
    RETURN NEW;
  END IF;
  IF token ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    UPDATE confirm_token SET used_at = app_now()
    WHERE id = token::uuid
      AND org_id::text = current_setting('app.org_id', true)
      AND user_id = current_setting('app.user_id', true)
      AND object_type = TG_TABLE_NAME
      AND object_id = NEW.id
      AND used_at IS NULL
      AND expires_at > app_now();
    GET DIAGNOSTICS used = ROW_COUNT;
  END IF;
  IF used = 1 THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'In die Mitte nur mit dem Token eines Menschen (ZA-01): % %', TG_TABLE_NAME, NEW.id
    USING ERRCODE = 'RZ001';
END
$$;--> statement-breakpoint

-- app_initiative_owner: letzte Fassung aus 0047_zusagen.sql, Uhr je Mandant (K1-a.2)
CREATE OR REPLACE FUNCTION app_initiative_owner(p_id uuid, p_user_id text, p_name text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_relationship uuid;
  v_status text;
BEGIN
  SELECT i.relationship_id, j.status INTO v_relationship, v_status
  FROM initiative i JOIN jbp j ON j.id = i.jbp_id
  WHERE i.id = p_id AND i.visibility = 'shared';
  IF v_relationship IS NULL OR NOT app_is_relationship_party(v_relationship) THEN
    RAISE EXCEPTION 'initiative_not_found';
  END IF;
  IF v_status = 'approved' THEN
    RAISE EXCEPTION 'plan_approved';
  END IF;
  IF app_is_relationship_buyer(v_relationship) THEN
    UPDATE initiative SET owner_buyer_user_id = p_user_id, owner_buyer_name = p_name,
      updated_at = app_now() WHERE id = p_id;
  ELSE
    UPDATE initiative SET owner_supplier_user_id = p_user_id, owner_supplier_name = p_name,
      updated_at = app_now() WHERE id = p_id;
  END IF;
END
$$;--> statement-breakpoint

-- app_initiative_save: letzte Fassung aus 0046_initiativen.sql, Uhr je Mandant (K1-a.2)
CREATE OR REPLACE FUNCTION app_initiative_save(p_id uuid, p_title text, p_goal text, p_benefit_buyer text,
  p_benefit_supplier text, p_owner_buyer_name text, p_owner_supplier_name text, p_starts_on date,
  p_ends_on date) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
BEGIN
  IF app_initiative_check(p_id) THEN
    RAISE EXCEPTION 'plan_approved';
  END IF;
  UPDATE initiative
  SET title = p_title, goal = p_goal, benefit_buyer = p_benefit_buyer,
      benefit_supplier = p_benefit_supplier, owner_buyer_name = p_owner_buyer_name,
      owner_supplier_name = p_owner_supplier_name, starts_on = p_starts_on, ends_on = p_ends_on,
      updated_at = app_now()
  WHERE id = p_id;
END
$$;--> statement-breakpoint

-- app_initiative_share_confirm: letzte Fassung aus 0067_teilung_wirkungsarten.sql, Uhr je Mandant (K1-a.2)
CREATE OR REPLACE FUNCTION app_initiative_share_confirm(p_share_id uuid, p_name text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_relationship uuid;
  v_initiative uuid;
BEGIN
  SELECT s.relationship_id, s.initiative_id INTO v_relationship, v_initiative
  FROM initiative_share s WHERE s.id = p_share_id AND s.visibility = 'shared';
  IF v_relationship IS NULL OR NOT app_is_relationship_supplier(v_relationship) THEN
    RAISE EXCEPTION 'share_not_found';
  END IF;
  IF length(trim(coalesce(p_name, ''))) = 0 THEN
    RAISE EXCEPTION 'name_required';
  END IF;
  UPDATE initiative_share SET supplier_confirmed_by_name = p_name, agreed_at = app_now()
  WHERE id = p_share_id;
  UPDATE initiative_value SET visibility = 'shared'
  WHERE initiative_id = v_initiative AND visibility <> 'shared';
END
$$;--> statement-breakpoint

-- app_initiative_status: letzte Fassung aus 0046_initiativen.sql, Uhr je Mandant (K1-a.2)
CREATE OR REPLACE FUNCTION app_initiative_status(p_id uuid, p_status text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
BEGIN
  PERFORM app_initiative_check(p_id);
  UPDATE initiative SET status = p_status, updated_at = app_now() WHERE id = p_id;
END
$$;--> statement-breakpoint

-- app_jbp_topic_merge: letzte Fassung aus 0046_initiativen.sql, Uhr je Mandant (K1-a.2)
CREATE OR REPLACE FUNCTION app_jbp_topic_merge(p_topic_id uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_relationship uuid;
BEGIN
  SELECT t.relationship_id INTO v_relationship FROM jbp_topic t
  WHERE t.id = p_topic_id AND t.visibility = 'shared' AND t.status <> 'merged';
  IF v_relationship IS NULL OR NOT app_is_relationship_party(v_relationship) THEN
    RAISE EXCEPTION 'topic_not_found';
  END IF;
  UPDATE jbp_topic SET status = 'merged', updated_at = app_now() WHERE id = p_topic_id;
END
$$;--> statement-breakpoint

-- app_massnahme_status: letzte Fassung aus 0042_massnahmen.sql, Uhr je Mandant (K1-a.2)
CREATE OR REPLACE FUNCTION app_massnahme_status(p_action_id uuid, p_status text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_relationship uuid;
BEGIN
  SELECT a.relationship_id INTO v_relationship FROM action a
  WHERE a.id = p_action_id AND a.visibility = 'shared';
  IF v_relationship IS NULL OR NOT app_is_relationship_party(v_relationship) THEN
    RAISE EXCEPTION 'action_not_found';
  END IF;
  UPDATE action
  SET status = p_status,
      done_at = CASE WHEN p_status = 'done' THEN app_now() ELSE NULL END,
      updated_at = app_now()
  WHERE id = p_action_id;
END
$$;--> statement-breakpoint

-- app_survey_close: letzte Fassung aus 0054_feedback_wellen.sql, Uhr je Mandant (K1-a.2)
CREATE OR REPLACE FUNCTION app_survey_close(p_wave_id uuid) RETURNS text
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_relationship uuid;
  v_side text;
BEGIN
  SELECT w.relationship_id INTO v_relationship FROM survey_wave w WHERE w.id = p_wave_id;
  IF v_relationship IS NULL THEN
    RAISE EXCEPTION 'wave_not_found';
  ELSIF app_is_relationship_buyer(v_relationship) THEN
    v_side := 'buyer';
    UPDATE survey_wave SET buyer_closed_at = app_now()
      WHERE id = p_wave_id AND buyer_closed_at IS NULL;
  ELSIF app_is_relationship_supplier(v_relationship) THEN
    v_side := 'supplier';
    UPDATE survey_wave SET supplier_closed_at = app_now()
      WHERE id = p_wave_id AND supplier_closed_at IS NULL;
  ELSE
    RAISE EXCEPTION 'wave_not_found';
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'already_closed';
  END IF;
  RETURN v_side;
END;
$$;--> statement-breakpoint

-- app_survey_reveal: letzte Fassung aus 0058_aufdeckung_mehrfach.sql, Uhr je Mandant (K1-a.2)
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
  IF NOT ((v_buyer_closed IS NOT NULL AND v_supplier_closed IS NOT NULL) OR v_due < app_now()::date) THEN
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

  UPDATE survey_wave SET revealed_at = app_now() WHERE id = p_wave_id;
  RETURN true;
END;
$$;--> statement-breakpoint

-- app_umfrage_meine: letzte Fassung aus 0079_feedback_in_der_app.sql, Uhr je Mandant (K1-a.2)
CREATE OR REPLACE FUNCTION app_umfrage_meine()
RETURNS TABLE (participant_id uuid, token_hash text, wave_id uuid, relationship_id uuid,
  side text, kind text, due_date date, status text, buyer text, supplier text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT p.id, p.token_hash, w.id, r.id, p.side, w.kind, w.due_date,
      CASE
        WHEN p.completed_at IS NOT NULL THEN 'used'
        WHEN w.due_date < app_now()::date OR r.status = 'ended'
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
  $$;
--> statement-breakpoint

-- Echtzeit für Technik in SQL (Ablauf von Links, Zustellung von Mails, Wiederholungen): bewusst
-- benannt, damit kein now() ohne Absicht im Code steht (Test in apps/api, clock.node.test.ts).
CREATE FUNCTION app_system_now() RETURNS timestamptz
  LANGUAGE sql STABLE
  AS $$ SELECT now() $$;
