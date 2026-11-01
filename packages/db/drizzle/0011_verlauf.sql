CREATE TABLE "audit_event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"actor_org_id" uuid GENERATED ALWAYS AS (owner_org_id) STORED NOT NULL,
	"visibility" text NOT NULL,
	"relationship_id" uuid,
	"object_type" text NOT NULL,
	"object_id" text NOT NULL,
	"action" text NOT NULL,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "audit_event_action" CHECK ("audit_event"."action" in ('created', 'updated', 'ended', 'shared', 'approved'))
);
--> statement-breakpoint
CREATE TABLE "outbox_event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_type" text NOT NULL,
	"object_type" text NOT NULL,
	"object_id" text NOT NULL,
	"audit_event_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"processed_at" timestamp with time zone
);

--> statement-breakpoint

-- PLT-08: Verlauf und Outbox.

-- 1. Geteilte Zeilen ohne Beziehung (z. B. Verlauf zu Rollen) sieht nur die eigene Organisation.
--    Sonst bleibt app_apply_layer wie in 0008.
CREATE OR REPLACE FUNCTION app_apply_layer(p_table regclass, p_kind text) RETURNS void
  LANGUAGE plpgsql
  AS $$
DECLARE
  t text := (SELECT relname FROM pg_class WHERE oid = p_table);
  has_relationship boolean := EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = p_table AND attname = 'relationship_id' AND NOT attisdropped
  );

  required text[] := CASE p_kind
    WHEN 'buyer_private' THEN ARRAY['relationship_id']
    WHEN 'supplier_private' THEN ARRAY['relationship_id']
    WHEN 'org_private' THEN ARRAY['org_id']
    WHEN 'shared' THEN ARRAY['relationship_id', 'owner_org_id', 'visibility']
    WHEN 'global' THEN ARRAY[]::text[]
  END;
  missing text;
BEGIN
  IF required IS NULL THEN
    RAISE EXCEPTION 'Unbekannte Datenebene % für %', p_kind, t;
  END IF;
  SELECT string_agg(c, ', ') INTO missing FROM unnest(required) AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_attribute WHERE attrelid = p_table AND attname = c AND NOT attisdropped
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Tabelle % braucht für % die Spalten: %', t, p_kind, missing;
  END IF;

  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', p_table);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO reziproq_app', p_table);

  IF p_kind = 'buyer_private' THEN
    EXECUTE format(
      'CREATE POLICY %I ON %s FOR ALL TO reziproq_app
         USING (app_is_relationship_buyer(relationship_id))
         WITH CHECK (app_is_relationship_buyer(relationship_id))',
      t || '_buyer_private', p_table);

  ELSIF p_kind = 'supplier_private' THEN
    EXECUTE format(
      'CREATE POLICY %I ON %s FOR ALL TO reziproq_app
         USING (app_is_relationship_supplier(relationship_id))
         WITH CHECK (app_is_relationship_supplier(relationship_id))',
      t || '_supplier_private', p_table);

  ELSIF p_kind = 'org_private' THEN
    IF has_relationship THEN
      EXECUTE format(
        'CREATE POLICY %I ON %s FOR ALL TO reziproq_app
           USING (org_id = app_current_organization_id())
           WITH CHECK (
             org_id = app_current_organization_id()
             AND (relationship_id IS NULL OR app_is_relationship_party(relationship_id))
           )',
        t || '_org_private', p_table);
    ELSE
      EXECUTE format(
        'CREATE POLICY %I ON %s FOR ALL TO reziproq_app
           USING (org_id = app_current_organization_id())
           WITH CHECK (org_id = app_current_organization_id())',
        t || '_org_private', p_table);
    END IF;

  ELSIF p_kind = 'shared' THEN
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I CHECK (visibility IN (''internal'', ''shared''))',
      p_table, t || '_visibility');
    EXECUTE format(
      'CREATE POLICY %I ON %s FOR SELECT TO reziproq_app
         USING (
           owner_org_id = app_current_organization_id()
           OR (visibility = ''shared'' AND app_can_see_relationship(relationship_id))
         )',
      t || '_shared_read', p_table);
    EXECUTE format(
      'CREATE POLICY %I ON %s FOR INSERT TO reziproq_app
         WITH CHECK (
           owner_org_id = app_current_organization_id()
           AND (relationship_id IS NULL OR app_is_relationship_party(relationship_id))
         )',
      t || '_shared_insert', p_table);
    EXECUTE format(
      'CREATE POLICY %I ON %s FOR UPDATE TO reziproq_app
         USING (owner_org_id = app_current_organization_id())
         WITH CHECK (
           owner_org_id = app_current_organization_id()
           AND (relationship_id IS NULL OR app_is_relationship_party(relationship_id))
         )',
      t || '_shared_update', p_table);
    EXECUTE format(
      'CREATE POLICY %I ON %s FOR DELETE TO reziproq_app
         USING (owner_org_id = app_current_organization_id())',
      t || '_shared_delete', p_table);
  END IF;

  -- Lieferantennutzer arbeiten im Kontext genau eines Kunden (app.customer_org_id).
  IF has_relationship AND p_kind <> 'global' THEN
    EXECUTE format(
      'CREATE POLICY %I ON %s AS RESTRICTIVE FOR ALL TO reziproq_app
         USING (app_relationship_customer_ok(relationship_id))
         WITH CHECK (app_relationship_customer_ok(relationship_id))',
      t || '_customer', p_table);
  END IF;
END
$$;--> statement-breakpoint

-- 2. Verlauf: geteilt nach PLT-04, die API darf nur anlegen und lesen.
SELECT app_apply_layer('audit_event', 'shared');--> statement-breakpoint
REVOKE UPDATE, DELETE ON "audit_event" FROM reziproq_app;--> statement-breakpoint

-- Niemand ändert oder löscht den Verlauf, auch nicht der Eigentümer der Tabelle.
CREATE FUNCTION app_audit_unveraenderlich() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  RAISE EXCEPTION 'Der Verlauf ist unveränderlich: % auf audit_event ist nicht erlaubt', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END
$$;--> statement-breakpoint
CREATE TRIGGER "audit_event_unveraenderlich"
  BEFORE UPDATE OR DELETE ON "audit_event"
  FOR EACH ROW EXECUTE FUNCTION app_audit_unveraenderlich();--> statement-breakpoint
CREATE TRIGGER "audit_event_nicht_leeren"
  BEFORE TRUNCATE ON "audit_event"
  FOR EACH STATEMENT EXECUTE FUNCTION app_audit_unveraenderlich();--> statement-breakpoint

-- 3. Outbox: nur Betrieb. Die API legt Einträge der eigenen Organisation an und liest nichts;
--    verarbeitet werden sie später von Jobs mit eigener Rolle (QS-01).
ALTER TABLE "outbox_event" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "outbox_event" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT INSERT ON "outbox_event" TO reziproq_app;--> statement-breakpoint
CREATE POLICY "outbox_event_anlegen" ON "outbox_event"
  FOR INSERT TO reziproq_app
  WITH CHECK ("org_id" = app_current_organization_id());
