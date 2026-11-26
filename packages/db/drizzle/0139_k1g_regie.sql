CREATE TABLE "demo_event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor_user_id" text,
	"demo_now" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" text NOT NULL,
	"demo_now" timestamp with time zone,
	"seed_version" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	CONSTRAINT "demo_snapshot_stand" UNIQUE("org_id","key")
);
--> statement-breakpoint
ALTER TABLE "demo_event" ADD CONSTRAINT "demo_event_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "demo_snapshot" ADD CONSTRAINT "demo_snapshot_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- DM-01 (K1-g.1): Protokoll und Stände der Demo-Regie gibt es nur im Demo-Mandanten. Zusätzlich zur
-- Ebene org_private lässt die Policy Lesen und Schreiben nur für Organisationen mit is_demo zu.
SELECT app_apply_layer('demo_event', 'org_private');--> statement-breakpoint
CREATE POLICY demo_event_demo ON demo_event AS RESTRICTIVE FOR ALL TO reziproq_app
  USING (app_org_is_demo(org_id)) WITH CHECK (app_org_is_demo(org_id));--> statement-breakpoint
SELECT app_apply_layer('demo_snapshot', 'org_private');--> statement-breakpoint
CREATE POLICY demo_snapshot_demo ON demo_snapshot AS RESTRICTIVE FOR ALL TO reziproq_app
  USING (app_org_is_demo(org_id)) WITH CHECK (app_org_is_demo(org_id));--> statement-breakpoint
-- Die Organisationen der Demo: der Demo-Mandant und alle Demo-Mandanten, die über Beziehungen mit
-- ihm verbunden sind (Nordwind, seine Lieferanten, deren weitere Kunden wie Halder). Ist p_org kein
-- Demo-Mandant, ist die Menge leer.
CREATE FUNCTION app_demo_orgs_von(p_org uuid) RETURNS SETOF uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    WITH RECURSIVE story(id) AS (
      SELECT o.id FROM organization o WHERE o.id = p_org AND o.is_demo
      UNION
      SELECT o.id
      FROM story s
      JOIN relationship r ON s.id IN (r.buyer_org_id, r.supplier_org_id)
      JOIN organization o
        ON o.id = CASE WHEN r.buyer_org_id = s.id THEN r.supplier_org_id ELSE r.buyer_org_id END
      WHERE o.is_demo
    )
    SELECT id FROM story
  $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_demo_orgs_von(uuid) FROM PUBLIC;--> statement-breakpoint
-- Dasselbe für die Organisation der Session; die API braucht es für die Läufe der Demo-Uhr.
CREATE FUNCTION app_demo_orgs() RETURNS SETOF uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT app_demo_orgs_von(nullif(current_setting('app.org_id', true), '')::uuid) $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_demo_orgs() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_demo_orgs() TO reziproq_app;--> statement-breakpoint
-- Demo-Uhr aller Organisationen der Demo setzen (Regie: Zeit). Liefert die Zahl der Organisationen.
CREATE FUNCTION app_demo_uhr_setzen(p_now timestamptz) RETURNS integer
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  changed integer := 0;
BEGIN
  UPDATE organization SET demo_now = p_now WHERE id IN (SELECT app_demo_orgs()) AND is_demo;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_demo_uhr_setzen(timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_demo_uhr_setzen(timestamptz) TO reziproq_app;--> statement-breakpoint
-- Sammelt alle Zeilen der Organisationen der Demo in pg_temp.demo_zeilen (Tabelle, ctid):
-- 1. direkt über Spalten, die eine Organisation tragen (Fremdschlüssel auf organization oder die
--    üblichen Namen), 2. über Fremdschlüssel alle Zeilen, die auf eine gesammelte Zeile zeigen, in
--    Runden bis nichts mehr dazukommt. Ausgenommen: die Organisationen selbst, die Aufzeichnungen
--    der KI, Protokoll und Stände der Regie; sie überdauern das Zurücksetzen. Zum Schluss bricht die
--    Funktion ab, wenn eine gesammelte Zeile auch einer Organisation außerhalb der Demo gehört.
CREATE FUNCTION app_demo_zeilen_sammeln(p_orgs uuid[]) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  r record;
  v_runde integer := 0;
  neu bigint;
  mixed boolean;
  ausgenommen text[] := ARRAY['organization', 'model_call_recording', 'demo_event', 'demo_snapshot'];
BEGIN
  DROP TABLE IF EXISTS pg_temp.demo_zeilen;
  CREATE TEMP TABLE demo_zeilen (
    tbl regclass NOT NULL,
    row_ctid tid NOT NULL,
    runde integer NOT NULL,
    PRIMARY KEY (tbl, row_ctid)
  ) ON COMMIT DROP;
  FOR r IN
    SELECT c.oid::regclass AS tbl, a.attname AS col
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    WHERE c.relkind = 'r' AND NOT (c.relname = ANY(ausgenommen))
      AND a.atttypid = 'uuid'::regtype
      AND (a.attname IN ('org_id', 'owner_org_id', 'organization_id', 'buyer_org_id', 'supplier_org_id')
        OR EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype = 'f'
          AND k.confrelid = 'organization'::regclass AND a.attnum = ANY(k.conkey)))
  LOOP
    EXECUTE format(
      'INSERT INTO pg_temp.demo_zeilen SELECT %L::regclass, x.ctid, 0 FROM %s x WHERE x.%I = ANY($1)
       ON CONFLICT DO NOTHING', r.tbl, r.tbl, r.col) USING p_orgs;
  END LOOP;
  LOOP
    neu := 0;
    FOR r IN
      SELECT k.conrelid::regclass AS child, k.confrelid::regclass AS parent,
        (SELECT string_agg(format('c.%I = p.%I', ca.attname, pa.attname), ' AND ')
         FROM unnest(k.conkey, k.confkey) AS u(ck, pk)
         JOIN pg_attribute ca ON ca.attrelid = k.conrelid AND ca.attnum = u.ck
         JOIN pg_attribute pa ON pa.attrelid = k.confrelid AND pa.attnum = u.pk) AS cond
      FROM pg_constraint k
      JOIN pg_class cc ON cc.oid = k.conrelid
      JOIN pg_namespace n ON n.oid = cc.relnamespace AND n.nspname = 'public'
      WHERE k.contype = 'f' AND k.confrelid <> 'organization'::regclass
        AND NOT (cc.relname = ANY(ausgenommen))
        AND EXISTS (SELECT 1 FROM pg_temp.demo_zeilen z WHERE z.tbl = k.confrelid AND z.runde = v_runde)
    LOOP
      EXECUTE format(
        'INSERT INTO pg_temp.demo_zeilen SELECT %L::regclass, c.ctid, %s FROM %s c JOIN %s p ON %s
         WHERE p.ctid IN (SELECT z.row_ctid FROM pg_temp.demo_zeilen z
           WHERE z.tbl = %L::regclass AND z.runde = %s)
         ON CONFLICT DO NOTHING', r.child, v_runde + 1, r.child, r.parent, r.cond, r.parent, v_runde);
    END LOOP;
    SELECT count(*) INTO neu FROM pg_temp.demo_zeilen z WHERE z.runde = v_runde + 1;
    EXIT WHEN neu = 0;
    v_runde := v_runde + 1;
  END LOOP;
  FOR r IN
    SELECT c.oid::regclass AS tbl, a.attname AS col
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    WHERE c.relkind = 'r' AND NOT (c.relname = ANY(ausgenommen))
      AND a.atttypid = 'uuid'::regtype
      AND (a.attname IN ('org_id', 'owner_org_id', 'organization_id', 'buyer_org_id', 'supplier_org_id')
        OR EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conrelid = c.oid AND k.contype = 'f'
          AND k.confrelid = 'organization'::regclass AND a.attnum = ANY(k.conkey)))
      AND EXISTS (SELECT 1 FROM pg_temp.demo_zeilen z WHERE z.tbl = c.oid)
  LOOP
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %s x WHERE x.ctid IN (SELECT z.row_ctid FROM pg_temp.demo_zeilen z
         WHERE z.tbl = %L::regclass) AND x.%I IS NOT NULL AND x.%I <> ALL($1))',
      r.tbl, r.tbl, r.col, r.col) INTO mixed USING p_orgs;
    IF mixed THEN
      RAISE EXCEPTION 'Zeilen in % gehören auch einer Organisation außerhalb der Demo (%)', r.tbl, r.col;
    END IF;
  END LOOP;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_demo_zeilen_sammeln(uuid[]) FROM PUBLIC;--> statement-breakpoint
-- Hält den Stand aller Organisationen der Demo von p_org als Schnappschuss fest (Seed: „start“).
-- Nur für den Eigentümer der Tabellen, also für Skripte wie pnpm demo:nordwind.
CREATE FUNCTION app_demo_schnappschuss(p_org uuid, p_key text) RETURNS uuid
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  orgs uuid[] := ARRAY(SELECT app_demo_orgs_von(p_org));
  daten jsonb := '{}'::jsonb;
  t regclass;
  zeilen jsonb;
  snap uuid;
BEGIN
  IF cardinality(orgs) = 0 THEN
    RAISE EXCEPTION 'Kein Demo-Mandant: %', p_org;
  END IF;
  PERFORM app_demo_zeilen_sammeln(orgs);
  FOR t IN SELECT DISTINCT z.tbl FROM pg_temp.demo_zeilen z LOOP
    EXECUTE format(
      'SELECT jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text) FROM %s x
       WHERE x.ctid IN (SELECT z.row_ctid FROM pg_temp.demo_zeilen z WHERE z.tbl = %L::regclass)',
      t, t) INTO zeilen;
    daten := daten || jsonb_build_object(t::text, zeilen);
  END LOOP;
  INSERT INTO demo_snapshot (org_id, key, demo_now, seed_version, data)
  SELECT p_org, p_key, o.demo_now, md5(daten::text), daten FROM organization o WHERE o.id = p_org
  ON CONFLICT (org_id, key) DO UPDATE
    SET demo_now = excluded.demo_now, seed_version = excluded.seed_version, data = excluded.data,
      created_at = app_now()
  RETURNING id INTO snap;
  RETURN snap;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_demo_schnappschuss(uuid, text) FROM PUBLIC;--> statement-breakpoint
-- Löscht alle Zeilen der Organisationen der Demo (ohne die Organisationen selbst, die Aufzeichnungen
-- der KI und Protokoll und Stände der Regie). Trigger und Prüfungen der Fremdschlüssel ruhen dabei
-- (session_replication_role), denn gesperrte Termine und eingefrorene Schnappschüsse sollen sich
-- gerade zurücksetzen lassen. Dafür braucht der Eigentümer der Funktion Superuser-Rechte (lokal:
-- reziproq aus docker-compose); ohne sie scheitert nur das Zurücksetzen.
CREATE FUNCTION app_demo_leeren_von(p_orgs uuid[]) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  SET session_replication_role = replica
  AS $$
DECLARE
  t regclass;
BEGIN
  PERFORM app_demo_zeilen_sammeln(p_orgs);
  FOR t IN SELECT DISTINCT z.tbl FROM pg_temp.demo_zeilen z LOOP
    EXECUTE format(
      'DELETE FROM %s WHERE ctid IN (SELECT z.row_ctid FROM pg_temp.demo_zeilen z WHERE z.tbl = %L::regclass)',
      t, t);
  END LOOP;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_demo_leeren_von(uuid[]) FROM PUBLIC;--> statement-breakpoint
-- Für pnpm demo:nordwind: vor dem Seed alles der Demo leeren, damit „start“ genau der Seed ist.
-- Gibt es den Demo-Mandanten noch nicht, gibt es nichts zu leeren. Nur für den Eigentümer.
CREATE FUNCTION app_demo_leeren(p_org uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  orgs uuid[] := ARRAY(SELECT app_demo_orgs_von(p_org));
BEGIN
  IF cardinality(orgs) > 0 THEN
    PERFORM app_demo_leeren_von(orgs);
  END IF;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_demo_leeren(uuid) FROM PUBLIC;--> statement-breakpoint
-- Lädt einen Stand für die Organisationen der Demo der Session (Regie: Zurücksetzen lädt „start“):
-- leert ihre Zeilen, spielt die des Schnappschusses wieder ein und stellt die Demo-Uhr. Trigger und
-- Prüfungen der Fremdschlüssel ruhen auch beim Einspielen, wie beim Leeren.
CREATE FUNCTION app_demo_stand_laden(p_key text) RETURNS timestamptz
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  SET session_replication_role = replica
  AS $$
DECLARE
  orgs uuid[] := ARRAY(SELECT app_demo_orgs());
  snap record;
  t regclass;
  tabelle text;
  zeilen jsonb;
  spalten text;
BEGIN
  IF cardinality(orgs) = 0 THEN
    RAISE EXCEPTION 'Stände gibt es nur im Demo-Mandanten' USING ERRCODE = '42501';
  END IF;
  SELECT s.data, s.demo_now INTO snap FROM demo_snapshot s
  WHERE s.org_id = ANY(orgs) AND s.key = p_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stand % fehlt', p_key USING ERRCODE = 'P0002';
  END IF;
  PERFORM app_demo_leeren_von(orgs);
  FOR tabelle, zeilen IN SELECT key, value FROM jsonb_each(snap.data) LOOP
    t := tabelle::regclass;
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) INTO spalten
    FROM pg_attribute a
    WHERE a.attrelid = t AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = '';
    EXECUTE format(
      'INSERT INTO %s (%s) OVERRIDING SYSTEM VALUE SELECT %s FROM jsonb_populate_recordset(NULL::%s, $1)',
      t, spalten, spalten, t) USING zeilen;
  END LOOP;
  UPDATE organization SET demo_now = snap.demo_now WHERE id = ANY(orgs);
  RETURN snap.demo_now;
END
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_demo_stand_laden(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_demo_stand_laden(text) TO reziproq_app;
