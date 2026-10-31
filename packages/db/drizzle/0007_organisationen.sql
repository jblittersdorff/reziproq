-- PLT-02: Organisationen ohne festen Typ, Freischaltungen, eigene Datenbankrolle für die API
-- und Row-Level Security mit FORCE auf allen Tabellen.

-- 1. Organisationen ------------------------------------------------------------------------

CREATE TABLE "organization_feature" (
	"organization_id" uuid NOT NULL,
	"feature" text NOT NULL,
	"enabled_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_feature_organization_id_feature_pk" PRIMARY KEY("organization_id","feature")
);
--> statement-breakpoint
ALTER TABLE "organization_feature" ADD CONSTRAINT "organization_feature_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Wer bisher Käufer war, behält die Käuferfunktionen; danach fällt der feste Typ weg.
INSERT INTO "organization_feature" ("organization_id", "feature")
  SELECT "id", 'buyer' FROM "organization" WHERE "typ" = 'kaeufer';--> statement-breakpoint
ALTER TABLE "organization" DROP COLUMN "typ";--> statement-breakpoint
DROP TYPE "public"."organization_typ";--> statement-breakpoint

-- land heißt jetzt country; umbenennen statt neu anlegen, damit kein Wert verloren geht.
ALTER TABLE "organization" DROP CONSTRAINT "organization_land_iso";--> statement-breakpoint
ALTER TABLE "organization" RENAME COLUMN "land" TO "country";--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_country_iso" CHECK ("organization"."country" ~ '^[A-Z]{2}$');--> statement-breakpoint

ALTER TABLE "organization" ADD COLUMN "vat_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "duns" text;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "zitadel_org_id" text;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_vat_id_eindeutig" UNIQUE("vat_id");--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_duns_eindeutig" UNIQUE("duns");--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_zitadel_org_id_eindeutig" UNIQUE("zitadel_org_id");--> statement-breakpoint

-- 2. Rollen --------------------------------------------------------------------------------
--
-- reziproq_api:        Login der API. Nicht Eigentümer der Tabellen, ohne Sonderrechte.
--                      LOGIN und Passwort setzt `pnpm db:roles` aus API_DATABASE_URL.
-- reziproq_app:        Rolle der Mandanten-Session (0004). Die API wechselt in jeder Transaktion
--                      hinein; für sie gelten alle Policies.
-- reziproq_anmeldung:  Eigentümer der wenigen Funktionen, die vor der Session laufen müssen
--                      (Login, eigene Organisation, Betreiber-Zugang). Darf nur genau das.
-- Migrationen laufen mit der Eigentümer-Rolle aus DATABASE_URL.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reziproq_api') THEN
    CREATE ROLE reziproq_api NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE INHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reziproq_anmeldung') THEN
    CREATE ROLE reziproq_anmeldung NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint

GRANT reziproq_app TO reziproq_api;--> statement-breakpoint
-- Nötig, damit die Migration Funktionen an reziproq_anmeldung übergeben kann.
GRANT reziproq_anmeldung TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_api, reziproq_anmeldung;--> statement-breakpoint

GRANT SELECT ON "organization_feature", "app_user" TO reziproq_app;--> statement-breakpoint
GRANT SELECT ON "organization", "organization_feature" TO reziproq_anmeldung;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "app_user" TO reziproq_anmeldung;--> statement-breakpoint
GRANT INSERT ON "betreiber_zugriff" TO reziproq_anmeldung;--> statement-breakpoint

-- 3. Mandanten-Session ---------------------------------------------------------------------
--
-- withTenant (packages/db/src/tenant.ts) setzt in jeder Transaktion app.user_id und app.org_id.

CREATE OR REPLACE FUNCTION app_current_organization_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '') $$;--> statement-breakpoint

-- Freischaltungen: nur die eigenen.
ALTER TABLE "organization_feature" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "organization_feature_eigene" ON "organization_feature"
  FOR SELECT TO reziproq_app
  USING ("organization_id" = app_current_organization_id());--> statement-breakpoint

-- Nutzer: man selbst und die Mitglieder der eigenen Organisation.
ALTER TABLE "app_user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "app_user_selbst_und_eigene_organisation" ON "app_user"
  FOR SELECT TO reziproq_app
  USING (
    "id" = app_current_user_id()
    OR ("organization_id" IS NOT NULL AND "organization_id" = app_current_organization_id())
  );--> statement-breakpoint

-- Protokoll des Betreiber-Zugangs: nie über die Session lesbar.
ALTER TABLE "betreiber_zugriff" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- Die Anmelde-Rolle braucht genau diese Zugriffe, ohne Mandanten-Filter.
CREATE POLICY "organization_anmeldung" ON "organization"
  FOR SELECT TO reziproq_anmeldung USING (true);--> statement-breakpoint
CREATE POLICY "organization_feature_anmeldung" ON "organization_feature"
  FOR SELECT TO reziproq_anmeldung USING (true);--> statement-breakpoint
CREATE POLICY "app_user_anmeldung" ON "app_user"
  FOR ALL TO reziproq_anmeldung USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "betreiber_zugriff_anmeldung" ON "betreiber_zugriff"
  FOR INSERT TO reziproq_anmeldung WITH CHECK (true);--> statement-breakpoint

-- FORCE: RLS gilt auch für den Eigentümer der Tabellen. Nur Superuser umgehen sie noch.
ALTER TABLE "organization" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organization_feature" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_user" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "beziehung" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "beziehung_kaeufer" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "betreiber_zugriff" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- 4. Funktionen vor der Session --------------------------------------------------------------
--
-- Sie laufen mit den Rechten von reziproq_anmeldung (SECURITY DEFINER), nicht mit denen der API.
-- Nur reziproq_api darf sie aufrufen.

-- Login und /me: Name und E-Mail aus Zitadel speichern, die Organisation aus der Zitadel-
-- Organisation setzen (unbekannt: leer) und nach einer Anmeldung last_login_at aktualisieren.
CREATE FUNCTION app_nutzer_synchronisieren(
  p_id text, p_name text, p_given_name text, p_email text, p_zitadel_org_id text, p_anmeldung boolean
) RETURNS void
  LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    INSERT INTO app_user (id, name, given_name, email, organization_id, last_login_at)
    VALUES (
      p_id, p_name, p_given_name, p_email,
      (SELECT o.id FROM organization o WHERE o.zitadel_org_id = p_zitadel_org_id),
      CASE WHEN p_anmeldung THEN now() END
    )
    ON CONFLICT (id) DO UPDATE SET
      name = excluded.name,
      given_name = excluded.given_name,
      email = excluded.email,
      organization_id = excluded.organization_id,
      last_login_at = coalesce(excluded.last_login_at, app_user.last_login_at),
      updated_at = now()
  $$;--> statement-breakpoint

-- Zu welcher Organisation gehört die Person, und darf sie Käuferfunktionen nutzen?
CREATE FUNCTION app_organisation_des_nutzers(p_id text)
  RETURNS TABLE (id uuid, name text, country text, buyer boolean)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT o.id, o.name, o.country,
      EXISTS (SELECT 1 FROM organization_feature f WHERE f.organization_id = o.id AND f.feature = 'buyer')
    FROM app_user u JOIN organization o ON o.id = u.organization_id
    WHERE u.id = p_id
  $$;--> statement-breakpoint

-- Betreiber-Zugang (PLT-13): Kunden sind Organisationen mit Käuferfunktionen.
CREATE FUNCTION app_betreiber_kunden()
  RETURNS TABLE (id uuid, name text, country text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT o.id, o.name, o.country FROM organization o
    WHERE EXISTS (SELECT 1 FROM organization_feature f WHERE f.organization_id = o.id AND f.feature = 'buyer')
    ORDER BY o.name
  $$;--> statement-breakpoint

CREATE FUNCTION app_betreiber_protokoll(p_nutzer_id text, p_organization_id uuid, p_aktion text)
  RETURNS void
  LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    INSERT INTO betreiber_zugriff (nutzer_id, organization_id, aktion)
    VALUES (p_nutzer_id, p_organization_id, p_aktion)
  $$;--> statement-breakpoint

ALTER FUNCTION app_nutzer_synchronisieren(text, text, text, text, text, boolean) OWNER TO reziproq_anmeldung;--> statement-breakpoint
ALTER FUNCTION app_organisation_des_nutzers(text) OWNER TO reziproq_anmeldung;--> statement-breakpoint
ALTER FUNCTION app_betreiber_kunden() OWNER TO reziproq_anmeldung;--> statement-breakpoint
ALTER FUNCTION app_betreiber_protokoll(text, uuid, text) OWNER TO reziproq_anmeldung;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION app_nutzer_synchronisieren(text, text, text, text, text, boolean),
  app_organisation_des_nutzers(text), app_betreiber_kunden(), app_betreiber_protokoll(text, uuid, text)
  FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_nutzer_synchronisieren(text, text, text, text, text, boolean),
  app_organisation_des_nutzers(text), app_betreiber_kunden(), app_betreiber_protokoll(text, uuid, text)
  TO reziproq_api;
