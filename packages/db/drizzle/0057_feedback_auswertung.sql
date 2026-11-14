CREATE TABLE "survey_free_text" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wave_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"side" text NOT NULL,
	"text" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "survey_free_text_side" CHECK ("survey_free_text"."side" in ('buyer', 'supplier'))
);
--> statement-breakpoint
CREATE TABLE "survey_result" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wave_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"side" text NOT NULL,
	"function" text,
	"dimension" text NOT NULL,
	"question_key" text,
	"label_de" text,
	"label_en" text,
	"ist_mean" numeric(4, 2),
	"soll_mean" numeric(4, 2),
	"n" integer NOT NULL,
	CONSTRAINT "survey_result_side" CHECK ("survey_result"."side" in ('buyer', 'supplier')),
	CONSTRAINT "survey_result_n" CHECK ("survey_result"."n" >= 3)
);
--> statement-breakpoint
ALTER TABLE "survey_free_text" ADD CONSTRAINT "survey_free_text_wave_id_survey_wave_id_fk" FOREIGN KEY ("wave_id") REFERENCES "public"."survey_wave"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_free_text" ADD CONSTRAINT "survey_free_text_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_free_text" ADD CONSTRAINT "survey_free_text_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_result" ADD CONSTRAINT "survey_result_wave_id_survey_wave_id_fk" FOREIGN KEY ("wave_id") REFERENCES "public"."survey_wave"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_result" ADD CONSTRAINT "survey_result_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_result" ADD CONSTRAINT "survey_result_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "survey_free_text_wave" ON "survey_free_text" USING btree ("wave_id");--> statement-breakpoint
CREATE INDEX "survey_result_wave" ON "survey_result" USING btree ("wave_id");--> statement-breakpoint
SELECT app_apply_layer('survey_result', 'shared');--> statement-breakpoint
SELECT app_apply_layer('survey_free_text', 'shared');--> statement-breakpoint
-- PUL-03: Ergebnisse schreibt nur die Aufdeckung; die App liest sie.
REVOKE INSERT, UPDATE, DELETE ON "survey_result", "survey_free_text" FROM reziproq_app;--> statement-breakpoint
GRANT SELECT ("id", "relationship_id", "template_id", "due_date", "buyer_closed_at",
  "supplier_closed_at", "revealed_at") ON "survey_wave" TO reziproq_feedback;--> statement-breakpoint
GRANT UPDATE ("revealed_at") ON "survey_wave" TO reziproq_feedback;--> statement-breakpoint
GRANT SELECT ON "survey_response" TO reziproq_feedback;--> statement-breakpoint
GRANT SELECT ("id", "questions") ON "survey_template" TO reziproq_feedback;--> statement-breakpoint
GRANT INSERT ON "survey_result", "survey_free_text" TO reziproq_feedback;--> statement-breakpoint
CREATE POLICY survey_response_feedback ON "survey_response" FOR SELECT TO reziproq_feedback USING (true);--> statement-breakpoint
CREATE POLICY survey_template_feedback ON "survey_template" FOR SELECT TO reziproq_feedback USING (true);--> statement-breakpoint
CREATE POLICY survey_result_feedback ON "survey_result" FOR INSERT TO reziproq_feedback WITH CHECK (true);--> statement-breakpoint
CREATE POLICY survey_free_text_feedback ON "survey_free_text" FOR INSERT TO reziproq_feedback WITH CHECK (true);--> statement-breakpoint
-- Aufdeckung: sobald beide Seiten abgeschlossen haben oder die Frist abgelaufen ist und jede Seite
-- mindestens drei Antworten hat. Einmalig; danach true ohne erneute Rechnung.
CREATE FUNCTION app_survey_reveal(p_wave_id uuid) RETURNS boolean
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
$$;--> statement-breakpoint
ALTER FUNCTION app_survey_reveal(uuid) OWNER TO reziproq_feedback;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_survey_reveal(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_survey_reveal(uuid) TO reziproq_app;
