ALTER TABLE "beziehung" ADD COLUMN "ended_at" timestamp with time zone;--> statement-breakpoint

-- PLT-04: Drei Datenebenen. Jede Tabelle hat genau eine Art (Register in src/layers.ts):
-- buyer_private, supplier_private, org_private, shared oder global. Neue Tabellen bekommen ihre
-- Policies über app_apply_layer, statt sie von Hand zu schreiben.

-- 1. Rolle für die Prüffunktionen ------------------------------------------------------------
--
-- reziproq_ebenen: Eigentümer der Funktionen, die Beziehungen prüfen. Darf nur beziehung lesen,
-- damit die Policies sie nachschlagen können, ohne dass reziproq_app mehr Rechte bekommt.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reziproq_ebenen') THEN
    CREATE ROLE reziproq_ebenen NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint

GRANT reziproq_ebenen TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_ebenen;--> statement-breakpoint
GRANT SELECT ON "beziehung" TO reziproq_ebenen;--> statement-breakpoint
CREATE POLICY "beziehung_ebenen" ON "beziehung"
  FOR SELECT TO reziproq_ebenen USING (true);--> statement-breakpoint

-- 2. Mandanten-Session ---------------------------------------------------------------------
--
-- app.customer_org_id: der Kunde, in dessen Kontext ein Lieferantennutzer arbeitet. Gesetzt
-- ab LIF-02 (withTenant); leer heißt für die Lieferantenseite: nichts Beziehungsbezogenes.

CREATE FUNCTION app_current_customer_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.customer_org_id', true), '')::uuid $$;--> statement-breakpoint

-- Ist die eigene Organisation Käufer dieser Beziehung?
CREATE FUNCTION app_is_relationship_buyer(p_relationship_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM beziehung b
      WHERE b.id = p_relationship_id AND b.kaeufer_org_id = app_current_organization_id()
    )
  $$;--> statement-breakpoint

-- Ist die eigene Organisation Lieferant dieser Beziehung, im Kontext genau dieses Kunden?
CREATE FUNCTION app_is_relationship_supplier(p_relationship_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM beziehung b
      WHERE b.id = p_relationship_id
        AND b.lieferant_org_id = app_current_organization_id()
        AND b.kaeufer_org_id = app_current_customer_id()
    )
  $$;--> statement-breakpoint

-- Steht die eigene Organisation auf einer Seite dieser Beziehung?
CREATE FUNCTION app_is_relationship_party(p_relationship_id uuid) RETURNS boolean
  LANGUAGE sql STABLE
  AS $$
    SELECT app_is_relationship_buyer(p_relationship_id)
      OR app_is_relationship_supplier(p_relationship_id)
  $$;--> statement-breakpoint

-- Darf die eigene Organisation freigegebene Zeilen dieser Beziehung sehen? Nur als Partei und
-- nur, solange die Beziehung aktiv ist.
CREATE FUNCTION app_can_see_relationship(p_relationship_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM beziehung b
      WHERE b.id = p_relationship_id
        AND b.ended_at IS NULL
        AND (
          b.kaeufer_org_id = app_current_organization_id()
          OR (
            b.lieferant_org_id = app_current_organization_id()
            AND b.kaeufer_org_id = app_current_customer_id()
          )
        )
    )
  $$;--> statement-breakpoint

-- Restriktiv für die Lieferantenseite: Zeilen einer Beziehung nur im Kontext ihres Kunden.
-- Für Käufer und Fremde ohne Wirkung; die übrigen Policies entscheiden dort.
CREATE FUNCTION app_relationship_customer_ok(p_relationship_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT NOT EXISTS (
      SELECT 1 FROM beziehung b
      WHERE b.id = p_relationship_id
        AND b.lieferant_org_id = app_current_organization_id()
        AND b.kaeufer_org_id IS DISTINCT FROM app_current_customer_id()
    )
  $$;--> statement-breakpoint

-- Steht diese Organisation mit der eigenen in Beziehung, in welcher Richtung auch immer?
-- Für Stammdaten (global), unabhängig vom gewählten Kunden.
CREATE FUNCTION app_is_related_organization(p_organization_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM beziehung b
      WHERE (b.kaeufer_org_id = app_current_organization_id() AND b.lieferant_org_id = p_organization_id)
         OR (b.lieferant_org_id = app_current_organization_id() AND b.kaeufer_org_id = p_organization_id)
    )
  $$;--> statement-breakpoint

ALTER FUNCTION app_is_relationship_buyer(uuid) OWNER TO reziproq_ebenen;--> statement-breakpoint
ALTER FUNCTION app_is_relationship_supplier(uuid) OWNER TO reziproq_ebenen;--> statement-breakpoint
ALTER FUNCTION app_can_see_relationship(uuid) OWNER TO reziproq_ebenen;--> statement-breakpoint
ALTER FUNCTION app_relationship_customer_ok(uuid) OWNER TO reziproq_ebenen;--> statement-breakpoint
ALTER FUNCTION app_is_related_organization(uuid) OWNER TO reziproq_ebenen;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION app_is_relationship_buyer(uuid), app_is_relationship_supplier(uuid),
  app_is_relationship_party(uuid), app_can_see_relationship(uuid),
  app_relationship_customer_ok(uuid), app_is_related_organization(uuid)
  FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_is_relationship_buyer(uuid), app_is_relationship_supplier(uuid),
  app_is_relationship_party(uuid), app_can_see_relationship(uuid),
  app_relationship_customer_ok(uuid), app_is_related_organization(uuid)
  TO reziproq_app;--> statement-breakpoint

-- 3. Hilfsfunktion für neue Tabellen ----------------------------------------------------------
--
-- SELECT app_apply_layer('tabelle', 'shared'); in der Migration nach CREATE TABLE.
-- Schaltet RLS mit FORCE ein, gibt reziproq_app Lesen und Schreiben und legt die Policies an.
-- Erwartete Spalten: relationship_id (buyer_private, supplier_private, shared), org_id
-- (org_private), owner_org_id und visibility (shared).

CREATE FUNCTION app_apply_layer(p_table regclass, p_kind text) RETURNS void
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
           AND app_is_relationship_party(relationship_id)
         )',
      t || '_shared_insert', p_table);
    EXECUTE format(
      'CREATE POLICY %I ON %s FOR UPDATE TO reziproq_app
         USING (owner_org_id = app_current_organization_id())
         WITH CHECK (
           owner_org_id = app_current_organization_id()
           AND app_is_relationship_party(relationship_id)
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

REVOKE EXECUTE ON FUNCTION app_apply_layer(regclass, text) FROM PUBLIC;--> statement-breakpoint

-- 4. Bestehende Tabellen ---------------------------------------------------------------------

-- global: Stammdaten einer Organisation sieht jede Organisation, die mit ihr in Beziehung steht,
-- in beide Richtungen (bisher nur Käufer → Lieferant).
DROP POLICY "organization_eigene_und_lieferanten" ON "organization";--> statement-breakpoint
CREATE POLICY "organization_global" ON "organization"
  FOR SELECT TO reziproq_app
  USING ("id" = app_current_organization_id() OR app_is_related_organization("id"));--> statement-breakpoint

-- Die Beziehung selbst sehen beide Seiten; der Lieferant nur im Kontext dieses Kunden.
DROP POLICY "beziehung_eigener_kaeufer" ON "beziehung";--> statement-breakpoint
CREATE POLICY "beziehung_beide_seiten" ON "beziehung"
  FOR SELECT TO reziproq_app
  USING (
    "kaeufer_org_id" = app_current_organization_id()
    OR (
      "lieferant_org_id" = app_current_organization_id()
      AND "kaeufer_org_id" = app_current_customer_id()
    )
  );
