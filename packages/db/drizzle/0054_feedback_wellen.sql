CREATE TABLE "survey_participant" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"wave_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"side" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"function" text NOT NULL,
	"token_hash" text NOT NULL,
	"invited_by" text NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "survey_participant_side" CHECK ("survey_participant"."side" in ('buyer', 'supplier')),
	CONSTRAINT "survey_participant_email" CHECK (position('@' in "survey_participant"."email") > 1)
);
--> statement-breakpoint
CREATE TABLE "survey_wave" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"template_id" uuid NOT NULL,
	"template_version" integer NOT NULL,
	"kind" text NOT NULL,
	"due_date" date NOT NULL,
	"buyer_closed_at" timestamp with time zone,
	"supplier_closed_at" timestamp with time zone,
	"revealed_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "survey_wave_kind" CHECK ("survey_wave"."kind" in ('pulse', 'annual'))
);
--> statement-breakpoint
ALTER TABLE "outbox_event" DROP CONSTRAINT "outbox_event_email_payload";--> statement-breakpoint
ALTER TABLE "survey_participant" ADD CONSTRAINT "survey_participant_wave_id_survey_wave_id_fk" FOREIGN KEY ("wave_id") REFERENCES "public"."survey_wave"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_participant" ADD CONSTRAINT "survey_participant_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_participant" ADD CONSTRAINT "survey_participant_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_wave" ADD CONSTRAINT "survey_wave_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_wave" ADD CONSTRAINT "survey_wave_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "survey_participant_wave" ON "survey_participant" USING btree ("wave_id");--> statement-breakpoint
CREATE INDEX "survey_participant_token" ON "survey_participant" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "survey_wave_relationship" ON "survey_wave" USING btree ("relationship_id","created_at");--> statement-breakpoint
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_email_payload" CHECK ((
        ("outbox_event"."email_template" IS NULL AND "outbox_event"."email_locale" IS NULL
          AND "outbox_event"."email_recipient" IS NULL AND "outbox_event"."email_first_name" IS NULL
          AND "outbox_event"."email_title" IS NULL AND "outbox_event"."email_deadline" IS NULL
          AND "outbox_event"."email_link" IS NULL AND "outbox_event"."email_sender" IS NULL
          AND "outbox_event"."email_message" IS NULL)
        OR
        ("outbox_event"."email_template" IS NOT NULL
          AND "outbox_event"."email_template" IN (
            'invitation', 'reminder', 'approval', 'escalation', 'supplier_invitation', 'survey'
          )
          AND "outbox_event"."email_locale" IS NOT NULL
          AND "outbox_event"."email_locale" IN ('de', 'en')
          AND "outbox_event"."email_recipient" IS NOT NULL
          AND length(trim("outbox_event"."email_recipient")) > 0
          AND "outbox_event"."email_title" IS NOT NULL
          AND length(trim("outbox_event"."email_title")) > 0
          AND "outbox_event"."email_link" IS NOT NULL
          AND "outbox_event"."email_link" LIKE '/%'
          AND "outbox_event"."email_link" NOT LIKE '//%'
          AND position('?' in "outbox_event"."email_link") = 0
          AND position('#' in "outbox_event"."email_link") = 0
          AND position(chr(92) in "outbox_event"."email_link") = 0)
      ));--> statement-breakpoint
SELECT app_apply_layer('survey_wave', 'shared');--> statement-breakpoint
SELECT app_apply_layer('survey_participant', 'shared');--> statement-breakpoint
-- PUL-02: Rücklauf und Abschluss je Seite über eng gefasste Funktionen. Sie laufen als
-- reziproq_feedback: kein BYPASSRLS, nur die Spalten, die sie brauchen.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'reziproq_feedback') THEN
    CREATE ROLE reziproq_feedback NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint
GRANT reziproq_feedback TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_feedback;--> statement-breakpoint
GRANT SELECT ("id", "buyer_org_id", "supplier_org_id") ON "relationship" TO reziproq_feedback;--> statement-breakpoint
GRANT SELECT ("id", "relationship_id", "buyer_closed_at", "supplier_closed_at") ON "survey_wave" TO reziproq_feedback;--> statement-breakpoint
GRANT UPDATE ("buyer_closed_at", "supplier_closed_at") ON "survey_wave" TO reziproq_feedback;--> statement-breakpoint
GRANT SELECT ("wave_id", "side", "completed_at") ON "survey_participant" TO reziproq_feedback;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_is_relationship_party(uuid), app_is_relationship_buyer(uuid),
  app_is_relationship_supplier(uuid), app_can_see_relationship(uuid),
  app_relationship_customer_ok(uuid) TO reziproq_feedback;--> statement-breakpoint
CREATE POLICY relationship_feedback ON "relationship" FOR SELECT TO reziproq_feedback USING (true);--> statement-breakpoint
CREATE POLICY survey_wave_feedback ON "survey_wave" FOR ALL TO reziproq_feedback USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY survey_participant_feedback ON "survey_participant" FOR SELECT TO reziproq_feedback USING (true);--> statement-breakpoint
-- Rücklauf je Seite, nur Anzahlen; für beide Seiten der Beziehung.
CREATE FUNCTION app_survey_turnout(p_wave_id uuid)
  RETURNS TABLE (side text, invited integer, completed integer)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_relationship uuid;
BEGIN
  SELECT w.relationship_id INTO v_relationship FROM survey_wave w WHERE w.id = p_wave_id;
  IF v_relationship IS NULL OR NOT app_is_relationship_party(v_relationship) THEN
    RAISE EXCEPTION 'wave_not_found';
  END IF;
  RETURN QUERY
    SELECT s.side, count(p.side)::integer, count(p.completed_at)::integer
    FROM (VALUES ('buyer'), ('supplier')) AS s(side)
    LEFT JOIN survey_participant p ON p.wave_id = p_wave_id AND p.side = s.side
    GROUP BY s.side
    ORDER BY s.side;
END;
$$;--> statement-breakpoint
ALTER FUNCTION app_survey_turnout(uuid) OWNER TO reziproq_feedback;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_survey_turnout(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_survey_turnout(uuid) TO reziproq_app;--> statement-breakpoint
-- Eine Seite schließt ihre Teilnahme ab; nur die eigene Spalte, nur einmal.
CREATE FUNCTION app_survey_close(p_wave_id uuid) RETURNS text
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
    UPDATE survey_wave SET buyer_closed_at = now()
      WHERE id = p_wave_id AND buyer_closed_at IS NULL;
  ELSIF app_is_relationship_supplier(v_relationship) THEN
    v_side := 'supplier';
    UPDATE survey_wave SET supplier_closed_at = now()
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
ALTER FUNCTION app_survey_close(uuid) OWNER TO reziproq_feedback;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_survey_close(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_survey_close(uuid) TO reziproq_app;
