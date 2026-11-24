CREATE TABLE "confirm_token" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"purpose" text NOT NULL,
	"object_type" text NOT NULL,
	"object_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "confirm_token_frist" CHECK ("confirm_token"."expires_at" > "confirm_token"."created_at")
);
--> statement-breakpoint
CREATE TABLE "focus_item" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"level" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"sentence" text,
	"sentence_facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"object_type" text NOT NULL,
	"object_id" uuid,
	"relationship_id" uuid,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"score" bigint DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"state" text DEFAULT 'open' NOT NULL,
	"run_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "focus_item_quelle" UNIQUE("org_id","user_id","source_type","source_id"),
	CONSTRAINT "focus_item_level" CHECK ("focus_item"."level" in ('focus', 'review', 'done')),
	CONSTRAINT "focus_item_kind" CHECK ("focus_item"."kind" in ('decision', 'approval', 'conversation', 'draft', 'info')),
	CONSTRAINT "focus_item_state" CHECK ("focus_item"."state" in ('open', 'decided', 'snoozed', 'dismissed')),
	CONSTRAINT "focus_item_title" CHECK (length(trim("focus_item"."title")) between 1 and 300),
	CONSTRAINT "focus_item_facts" CHECK (jsonb_typeof("focus_item"."sentence_facts") = 'array')
);
--> statement-breakpoint
CREATE TABLE "worker_setting" (
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"agent_key" text NOT NULL,
	"level" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "worker_setting_org_id_user_id_agent_key_pk" PRIMARY KEY("org_id","user_id","agent_key"),
	CONSTRAINT "worker_setting_level" CHECK ("worker_setting"."level" in ('suggest', 'prepare', 'do'))
);
--> statement-breakpoint
ALTER TABLE "ai_draft" DROP CONSTRAINT "ai_draft_kind";--> statement-breakpoint
ALTER TABLE "action" ADD COLUMN "origin" text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "action" ADD COLUMN "origin_run_id" uuid;--> statement-breakpoint
ALTER TABLE "action" ADD COLUMN "origin_user_id" text;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "undo_payload" jsonb;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "undone_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "undone_by" text;--> statement-breakpoint
ALTER TABLE "ai_draft" ADD COLUMN "review_seconds" integer;--> statement-breakpoint
ALTER TABLE "ai_draft" ADD COLUMN "review_order" integer;--> statement-breakpoint
ALTER TABLE "ai_draft" ADD COLUMN "author_kind" text;--> statement-breakpoint
ALTER TABLE "commitment" ADD COLUMN "origin" text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "commitment" ADD COLUMN "origin_run_id" uuid;--> statement-breakpoint
ALTER TABLE "commitment" ADD COLUMN "origin_user_id" text;--> statement-breakpoint
ALTER TABLE "commitment" ADD COLUMN "confirm_state" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "commitment" ADD COLUMN "buyer_confirmed_by" text;--> statement-breakpoint
ALTER TABLE "commitment" ADD COLUMN "buyer_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "commitment" ADD COLUMN "supplier_confirmed_by" text;--> statement-breakpoint
ALTER TABLE "commitment" ADD COLUMN "supplier_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "initiative" ADD COLUMN "origin" text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "initiative" ADD COLUMN "origin_run_id" uuid;--> statement-breakpoint
ALTER TABLE "initiative" ADD COLUMN "origin_user_id" text;--> statement-breakpoint
ALTER TABLE "kpi_value" ADD COLUMN "origin" text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "kpi_value" ADD COLUMN "origin_run_id" uuid;--> statement-breakpoint
ALTER TABLE "kpi_value" ADD COLUMN "origin_user_id" text;--> statement-breakpoint
ALTER TABLE "kpi_value" ADD COLUMN "confirm_state" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "kpi_value" ADD COLUMN "buyer_confirmed_by" text;--> statement-breakpoint
ALTER TABLE "kpi_value" ADD COLUMN "buyer_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kpi_value" ADD COLUMN "supplier_confirmed_by" text;--> statement-breakpoint
ALTER TABLE "kpi_value" ADD COLUMN "supplier_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jbp_topic" ADD COLUMN "origin" text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "jbp_topic" ADD COLUMN "origin_run_id" uuid;--> statement-breakpoint
ALTER TABLE "jbp_topic" ADD COLUMN "origin_user_id" text;--> statement-breakpoint
ALTER TABLE "jbp_topic" ADD COLUMN "confirm_state" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "jbp_topic" ADD COLUMN "buyer_confirmed_by" text;--> statement-breakpoint
ALTER TABLE "jbp_topic" ADD COLUMN "buyer_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jbp_topic" ADD COLUMN "supplier_confirmed_by" text;--> statement-breakpoint
ALTER TABLE "jbp_topic" ADD COLUMN "supplier_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jbp_version" ADD COLUMN "origin" text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "jbp_version" ADD COLUMN "origin_run_id" uuid;--> statement-breakpoint
ALTER TABLE "jbp_version" ADD COLUMN "origin_user_id" text;--> statement-breakpoint
ALTER TABLE "jbp_version" ADD COLUMN "confirm_state" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "jbp_version" ADD COLUMN "buyer_confirmed_by" text;--> statement-breakpoint
ALTER TABLE "jbp_version" ADD COLUMN "buyer_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jbp_version" ADD COLUMN "supplier_confirmed_by" text;--> statement-breakpoint
ALTER TABLE "jbp_version" ADD COLUMN "supplier_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meeting_agenda_item" ADD COLUMN "origin" text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_agenda_item" ADD COLUMN "origin_run_id" uuid;--> statement-breakpoint
ALTER TABLE "meeting_agenda_item" ADD COLUMN "origin_user_id" text;--> statement-breakpoint
ALTER TABLE "meeting_agenda_item" ADD COLUMN "confirm_state" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_agenda_item" ADD COLUMN "buyer_confirmed_by" text;--> statement-breakpoint
ALTER TABLE "meeting_agenda_item" ADD COLUMN "buyer_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meeting_agenda_item" ADD COLUMN "supplier_confirmed_by" text;--> statement-breakpoint
ALTER TABLE "meeting_agenda_item" ADD COLUMN "supplier_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meeting_capture" ADD COLUMN "origin" text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_capture" ADD COLUMN "origin_run_id" uuid;--> statement-breakpoint
ALTER TABLE "meeting_capture" ADD COLUMN "origin_user_id" text;--> statement-breakpoint
ALTER TABLE "note" ADD COLUMN "origin" text DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "note" ADD COLUMN "origin_run_id" uuid;--> statement-breakpoint
ALTER TABLE "note" ADD COLUMN "origin_user_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "ai_mode" text DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "demo_now" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "confirm_token" ADD CONSTRAINT "confirm_token_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirm_token" ADD CONSTRAINT "confirm_token_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_item" ADD CONSTRAINT "focus_item_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_item" ADD CONSTRAINT "focus_item_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "focus_item" ADD CONSTRAINT "focus_item_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_setting" ADD CONSTRAINT "worker_setting_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worker_setting" ADD CONSTRAINT "worker_setting_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "confirm_token_objekt" ON "confirm_token" USING btree ("org_id","object_type","object_id");--> statement-breakpoint
CREATE INDEX "focus_item_person" ON "focus_item" USING btree ("org_id","user_id","level","state");--> statement-breakpoint
ALTER TABLE "action" ADD CONSTRAINT "action_origin" CHECK ("action"."origin" in ('human', 'reziproq', 'engine', 'import'));--> statement-breakpoint
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_author_kind" CHECK ("ai_draft"."author_kind" is null or "ai_draft"."author_kind" in ('mensch', 'mit_reziproq', 'reziproq'));--> statement-breakpoint
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_review_seconds" CHECK ("ai_draft"."review_seconds" is null or "ai_draft"."review_seconds" >= 0);--> statement-breakpoint
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_kind" CHECK ("ai_draft"."kind" in ('deviation_explanation', 'feedback_themes', 'plan_summary', 'pre_read', 'market_analysis', 'data_request', 'qbr_topics', 'qbr_risks', 'qbr_open_points', 'hint_explanation', 'brief_situation', 'brief_goals', 'brief_agenda', 'brief_internal_questions', 'brief_supplier_questions', 'brief_expected_questions', 'brief_risks', 'brief_open_points', 'capture_commitment', 'capture_action', 'capture_decision', 'capture_question', 'capture_commitment_change', 'capture_goal_check', 'mail_summary', 'agent_result', 'share_request'));--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_origin" CHECK ("commitment"."origin" in ('human', 'reziproq', 'engine', 'import'));--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_confirm_state" CHECK ("commitment"."confirm_state" in ('draft', 'buyer_confirmed', 'supplier_confirmed', 'both_confirmed'));--> statement-breakpoint
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_origin" CHECK ("initiative"."origin" in ('human', 'reziproq', 'engine', 'import'));--> statement-breakpoint
ALTER TABLE "kpi_value" ADD CONSTRAINT "kpi_value_origin" CHECK ("kpi_value"."origin" in ('human', 'reziproq', 'engine', 'import'));--> statement-breakpoint
ALTER TABLE "kpi_value" ADD CONSTRAINT "kpi_value_confirm_state" CHECK ("kpi_value"."confirm_state" in ('draft', 'buyer_confirmed', 'supplier_confirmed', 'both_confirmed'));--> statement-breakpoint
ALTER TABLE "jbp_topic" ADD CONSTRAINT "jbp_topic_origin" CHECK ("jbp_topic"."origin" in ('human', 'reziproq', 'engine', 'import'));--> statement-breakpoint
ALTER TABLE "jbp_topic" ADD CONSTRAINT "jbp_topic_confirm_state" CHECK ("jbp_topic"."confirm_state" in ('draft', 'buyer_confirmed', 'supplier_confirmed', 'both_confirmed'));--> statement-breakpoint
ALTER TABLE "jbp_version" ADD CONSTRAINT "jbp_version_origin" CHECK ("jbp_version"."origin" in ('human', 'reziproq', 'engine', 'import'));--> statement-breakpoint
ALTER TABLE "jbp_version" ADD CONSTRAINT "jbp_version_confirm_state" CHECK ("jbp_version"."confirm_state" in ('draft', 'buyer_confirmed', 'supplier_confirmed', 'both_confirmed'));--> statement-breakpoint
ALTER TABLE "meeting_agenda_item" ADD CONSTRAINT "meeting_agenda_item_origin" CHECK ("meeting_agenda_item"."origin" in ('human', 'reziproq', 'engine', 'import'));--> statement-breakpoint
ALTER TABLE "meeting_agenda_item" ADD CONSTRAINT "meeting_agenda_item_confirm_state" CHECK ("meeting_agenda_item"."confirm_state" in ('draft', 'buyer_confirmed', 'supplier_confirmed', 'both_confirmed'));--> statement-breakpoint
ALTER TABLE "meeting_capture" ADD CONSTRAINT "meeting_capture_origin" CHECK ("meeting_capture"."origin" in ('human', 'reziproq', 'engine', 'import'));--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_origin" CHECK ("note"."origin" in ('human', 'reziproq', 'engine', 'import'));--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_ai_mode" CHECK ("organization"."ai_mode" in ('fake', 'record', 'replay', 'live'));--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_demo_modus" CHECK ("organization"."ai_mode" = 'live' or "organization"."is_demo");--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_demo_uhr" CHECK ("organization"."demo_now" is null or "organization"."is_demo");--> statement-breakpoint

-- K1-a, Teil von Hand: Zeilensicherheit der neuen Tabellen, Vorbelegung, Raum je Zeile,
-- Token-Schutz für die Mitte und die Sichten next_action und commitment_rate.

-- 1. Fokus-Themen, Stufen und Tokens sieht und ändert nur die Person selbst (wie user_setting, 0088).
SELECT app_apply_layer('focus_item', 'org_private');--> statement-breakpoint
CREATE POLICY focus_item_own ON focus_item AS RESTRICTIVE FOR ALL TO reziproq_app
  USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());--> statement-breakpoint
SELECT app_apply_layer('worker_setting', 'org_private');--> statement-breakpoint
CREATE POLICY worker_setting_own ON worker_setting AS RESTRICTIVE FOR ALL TO reziproq_app
  USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());--> statement-breakpoint
SELECT app_apply_layer('confirm_token', 'org_private');--> statement-breakpoint
CREATE POLICY confirm_token_own ON confirm_token AS RESTRICTIVE FOR ALL TO reziproq_app
  USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());--> statement-breakpoint
-- Ein Token wird nur angelegt und verbraucht, nie umgeschrieben oder gelöscht.
REVOKE UPDATE, DELETE ON confirm_token FROM reziproq_app;--> statement-breakpoint

-- 2. Raum je Zeile (ZA-01, E-K0-03): abgeleitet aus der Ebene der Tabelle, der besitzenden
--    Organisation und visibility. Bei org_private ist die besitzende Organisation org_id.
--    Ohne Beziehung gibt es keinen Raum (null). Eigentümer ist reziproq_ebenen, das Beziehungen
--    lesen darf (0008).
CREATE FUNCTION app_row_space(p_kind text, p_relationship_id uuid, p_owner_org_id uuid, p_visibility text)
  RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT CASE
      WHEN p_kind = 'buyer_private' THEN 'buyer_private'
      WHEN p_kind = 'supplier_private' THEN 'supplier_private'
      WHEN p_relationship_id IS NULL THEN NULL
      WHEN p_kind = 'shared' AND p_visibility = 'shared' THEN 'shared'
      WHEN p_kind IN ('shared', 'org_private') THEN (
        SELECT CASE
          WHEN p_owner_org_id = r.buyer_org_id THEN 'buyer_private'
          WHEN p_owner_org_id = r.supplier_org_id THEN 'supplier_private'
        END
        FROM relationship r WHERE r.id = p_relationship_id
      )
    END
  $$;--> statement-breakpoint
ALTER FUNCTION app_row_space(text, uuid, uuid, text) OWNER TO reziproq_ebenen;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_row_space(text, uuid, uuid, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_row_space(text, uuid, uuid, text) TO reziproq_app;--> statement-breakpoint

-- 3. Vorbelegung der Herkunft (ZA-01, Migration): import, wenn aus dem Import, sonst human.
UPDATE kpi_value SET origin = 'import' WHERE source = 'csv';--> statement-breakpoint

-- 4. Bestätigung: Wer ein Objekt in die Mitte stellt, bestätigt es für seine Seite. Der Trigger
--    setzt das für neue Zeilen; die Vorbelegung macht dasselbe für den Bestand. Freigegebene
--    Versionen des Gemeinsamen Plans entstehen erst mit der zweiten Freigabe (both_confirmed).
CREATE FUNCTION app_confirm_owner_side() RETURNS trigger
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
    NEW.buyer_confirmed_at := now();
  ELSIF side = 'supplier_private' THEN
    NEW.confirm_state := 'supplier_confirmed';
    NEW.supplier_confirmed_by := nullif(current_setting('app.user_id', true), '');
    NEW.supplier_confirmed_at := now();
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
-- Agendapunkte abgeschlossener Termine sind gesperrt (0040); die Vorbelegung beschreibt nur den
-- Bestand und ändert keinen Inhalt, deshalb ruht die Sperre dafür kurz.
ALTER TABLE meeting_agenda_item DISABLE TRIGGER meeting_agenda_item_locked;--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['commitment', 'kpi_value', 'jbp_topic', 'jbp_version', 'meeting_agenda_item'] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF visibility ON %I
         FOR EACH ROW EXECUTE FUNCTION app_confirm_owner_side()',
      t || '_confirm_owner_side', t);
    EXECUTE format(
      'UPDATE %I x SET confirm_state = CASE
           WHEN x.owner_org_id = r.buyer_org_id THEN ''buyer_confirmed''
           ELSE ''supplier_confirmed'' END
         FROM relationship r
         WHERE r.id = x.relationship_id AND x.visibility = ''shared''', t);
  END LOOP;
END
$$;--> statement-breakpoint
UPDATE jbp_version SET confirm_state = 'both_confirmed';--> statement-breakpoint
ALTER TABLE meeting_agenda_item ENABLE TRIGGER meeting_agenda_item_locked;--> statement-breakpoint

-- 5. In die Mitte nur mit Token (ZA-01 Regel 3, G-5): Läuft eine Session für einen Lauf von
--    Reziproq (app.run_id), wechselt ein Objekt nur mit einem gültigen, ungenutzten Token der
--    Person für genau dieses Objekt nach shared; das Token gilt danach als verbraucht. Menschen
--    ohne Lauf bestätigen mit ihrer eigenen Anfrage. Eigentümer der Prüfung ist reziproq_token,
--    das nur confirm_token lesen und als verbraucht markieren darf.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reziproq_token') THEN
    CREATE ROLE reziproq_token NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint
GRANT reziproq_token TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_token;--> statement-breakpoint
GRANT SELECT, UPDATE (used_at) ON confirm_token TO reziproq_token;--> statement-breakpoint
CREATE POLICY confirm_token_pruefen ON confirm_token
  FOR ALL TO reziproq_token USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE FUNCTION app_guard_shared() RETURNS trigger
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
    UPDATE confirm_token SET used_at = now()
    WHERE id = token::uuid
      AND org_id::text = current_setting('app.org_id', true)
      AND user_id = current_setting('app.user_id', true)
      AND object_type = TG_TABLE_NAME
      AND object_id = NEW.id
      AND used_at IS NULL
      AND expires_at > now();
    GET DIAGNOSTICS used = ROW_COUNT;
  END IF;
  IF used = 1 THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'In die Mitte nur mit dem Token eines Menschen (ZA-01): % %', TG_TABLE_NAME, NEW.id
    USING ERRCODE = 'RZ001';
END
$$;--> statement-breakpoint
ALTER FUNCTION app_guard_shared() OWNER TO reziproq_token;--> statement-breakpoint
-- An jede geteilte Tabelle einer Beziehung (Spalten relationship_id, owner_org_id, visibility),
-- außer dem Verlauf.
-- Neue geteilte Tabellen bekommen den Trigger über app_guard_shared_attach; layers.test.ts prüft,
-- dass keine fehlt.
CREATE FUNCTION app_guard_shared_attach(p_table regclass) RETURNS void
  LANGUAGE plpgsql
  AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF visibility ON %s
       FOR EACH ROW EXECUTE FUNCTION app_guard_shared()',
    (SELECT relname FROM pg_class WHERE oid = p_table) || '_guard_shared', p_table);
END
$$;--> statement-breakpoint
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name IN ('relationship_id', 'owner_org_id', 'visibility')
      -- Der Verlauf ist kein Objekt in der Mitte, sondern das Protokoll dazu (PLT-08).
      AND c.table_name <> 'audit_event'
    GROUP BY c.table_name HAVING count(*) = 3
  LOOP
    PERFORM app_guard_shared_attach(t::regclass);
  END LOOP;
END
$$;--> statement-breakpoint

-- 6. next_action (HE-01, NAV-10): Sicht auf die offenen Fokus-Themen. Rechte wie focus_item.
CREATE VIEW next_action WITH (security_invoker = true) AS
  SELECT f.*
  FROM focus_item f
  WHERE f.level = 'focus'
    AND f.state = 'open'
    AND (f.snoozed_until IS NULL OR f.snoozed_until <= now());--> statement-breakpoint
GRANT SELECT ON next_action TO reziproq_app;--> statement-breakpoint

-- 7. commitment_rate (ZQ-01, ZA-01 Regel 4): gehaltene je fällige Zusagen je Beziehung, Seite und
--    Jahr; nur beidseitig bestätigte zählen. Status heute open, kept, missed (ZQ-01 erweitert sie).
CREATE VIEW commitment_rate WITH (security_invoker = true) AS
  SELECT c.relationship_id, c.side, extract(year from c.due_on)::integer AS year,
    count(*) FILTER (WHERE c.status = 'kept')::integer AS kept,
    count(*) FILTER (WHERE c.status IN ('kept', 'missed'))::integer AS due
  FROM commitment c
  WHERE c.confirm_state = 'both_confirmed'
  GROUP BY c.relationship_id, c.side, extract(year from c.due_on);--> statement-breakpoint
GRANT SELECT ON commitment_rate TO reziproq_app;
