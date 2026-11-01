ALTER TABLE "app_user" ADD COLUMN "org_role" text DEFAULT 'viewer' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "is_controlling" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "default_function" text;--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "roles_imported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_org_role" CHECK ("app_user"."org_role" in ('admin', 'member', 'viewer'));--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_default_function" CHECK ("app_user"."default_function" in ('purchasing', 'quality', 'engineering', 'logistics', 'programs', 'after_sales'));--> statement-breakpoint

-- PLT-05a: Rollen liegen in der Datenbank.

-- 1. Login: Rollen einmalig aus dem Zitadel-Token übernehmen ---------------------------------
--
-- admin bleibt admin, nutzer wird member, leser und alles andere viewer, controlling wird
-- is_controlling. Danach (roles_imported_at gesetzt) ändert das Token an den Rollen nichts mehr.

DROP FUNCTION app_nutzer_synchronisieren(text, text, text, text, text, boolean);--> statement-breakpoint
CREATE FUNCTION app_nutzer_synchronisieren(
  p_id text, p_name text, p_given_name text, p_email text, p_zitadel_org_id text,
  p_anmeldung boolean, p_token_roles text[]
) RETURNS void
  LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    INSERT INTO app_user (
      id, name, given_name, email, organization_id, last_login_at,
      org_role, is_controlling, roles_imported_at
    )
    VALUES (
      p_id, p_name, p_given_name, p_email,
      (SELECT o.id FROM organization o WHERE o.zitadel_org_id = p_zitadel_org_id),
      CASE WHEN p_anmeldung THEN now() END,
      CASE
        WHEN 'admin' = ANY (p_token_roles) THEN 'admin'
        WHEN 'nutzer' = ANY (p_token_roles) THEN 'member'
        ELSE 'viewer'
      END,
      coalesce('controlling' = ANY (p_token_roles), false),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = excluded.name,
      given_name = excluded.given_name,
      email = excluded.email,
      organization_id = excluded.organization_id,
      last_login_at = coalesce(excluded.last_login_at, app_user.last_login_at),
      org_role = CASE WHEN app_user.roles_imported_at IS NULL
        THEN excluded.org_role ELSE app_user.org_role END,
      is_controlling = CASE WHEN app_user.roles_imported_at IS NULL
        THEN excluded.is_controlling ELSE app_user.is_controlling END,
      roles_imported_at = coalesce(app_user.roles_imported_at, now()),
      updated_at = now()
  $$;--> statement-breakpoint
ALTER FUNCTION app_nutzer_synchronisieren(text, text, text, text, text, boolean, text[])
  OWNER TO reziproq_anmeldung;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_nutzer_synchronisieren(text, text, text, text, text, boolean, text[])
  FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_nutzer_synchronisieren(text, text, text, text, text, boolean, text[])
  TO reziproq_api;--> statement-breakpoint

-- 2. Organisation und Rolle vor der Session --------------------------------------------------

DROP FUNCTION app_organisation_des_nutzers(text);--> statement-breakpoint
CREATE FUNCTION app_organisation_des_nutzers(p_id text)
  RETURNS TABLE (id uuid, name text, country text, buyer boolean, org_role text, is_controlling boolean)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT o.id, o.name, o.country,
      EXISTS (SELECT 1 FROM organization_feature f WHERE f.organization_id = o.id AND f.feature = 'buyer'),
      u.org_role, u.is_controlling
    FROM app_user u JOIN organization o ON o.id = u.organization_id
    WHERE u.id = p_id
  $$;--> statement-breakpoint
ALTER FUNCTION app_organisation_des_nutzers(text) OWNER TO reziproq_anmeldung;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_organisation_des_nutzers(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_organisation_des_nutzers(text) TO reziproq_api;--> statement-breakpoint

-- 3. Rollen ändern: nur Admins der eigenen Organisation, nur diese drei Spalten ---------------

CREATE FUNCTION app_ist_admin() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM app_user u
      WHERE u.id = app_current_user_id()
        AND u.organization_id = app_current_organization_id()
        AND u.org_role = 'admin'
    )
  $$;--> statement-breakpoint
ALTER FUNCTION app_ist_admin() OWNER TO reziproq_anmeldung;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_ist_admin() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_ist_admin() TO reziproq_app;--> statement-breakpoint

GRANT UPDATE (org_role, is_controlling, default_function) ON "app_user" TO reziproq_app;--> statement-breakpoint
CREATE POLICY "app_user_rollen_aendern" ON "app_user"
  FOR UPDATE TO reziproq_app
  USING ("organization_id" = app_current_organization_id() AND app_ist_admin())
  WITH CHECK ("organization_id" = app_current_organization_id() AND app_ist_admin());--> statement-breakpoint

-- 4. Jede Organisation mit Admins behält mindestens einen --------------------------------------

CREATE FUNCTION app_letzter_admin_bleibt() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
BEGIN
  IF OLD.org_role = 'admin' AND NEW.org_role <> 'admin' AND OLD.organization_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM app_user u
       WHERE u.organization_id = OLD.organization_id AND u.org_role = 'admin' AND u.id <> OLD.id
     ) THEN
    RAISE EXCEPTION 'Es muss mindestens einen Admin geben' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
ALTER FUNCTION app_letzter_admin_bleibt() OWNER TO reziproq_anmeldung;--> statement-breakpoint
CREATE TRIGGER "app_user_letzter_admin"
  BEFORE UPDATE OF org_role ON "app_user"
  FOR EACH ROW EXECUTE FUNCTION app_letzter_admin_bleibt();
