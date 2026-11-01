ALTER TABLE "app_user" ADD COLUMN "locale" text;--> statement-breakpoint
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_locale" CHECK ("app_user"."locale" in ('de', 'en'));--> statement-breakpoint

-- PLT-09: Die Anmeldung bringt die Browsersprache mit. Sie gilt nur, solange noch keine Sprache
-- gespeichert ist; danach zählt die Wahl auf /profil/sprache, auch auf anderen Geräten.
DROP FUNCTION app_nutzer_synchronisieren(text, text, text, text, text, boolean, text[]);--> statement-breakpoint
CREATE FUNCTION app_nutzer_synchronisieren(
  p_id text, p_name text, p_given_name text, p_email text, p_zitadel_org_id text,
  p_anmeldung boolean, p_token_roles text[], p_browser_locale text
) RETURNS void
  LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    INSERT INTO app_user (
      id, name, given_name, email, organization_id, last_login_at,
      org_role, is_controlling, roles_imported_at, locale
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
      now(),
      CASE WHEN p_anmeldung THEN p_browser_locale END
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
      locale = coalesce(app_user.locale, excluded.locale),
      updated_at = now()
  $$;--> statement-breakpoint
ALTER FUNCTION app_nutzer_synchronisieren(text, text, text, text, text, boolean, text[], text)
  OWNER TO reziproq_anmeldung;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_nutzer_synchronisieren(text, text, text, text, text, boolean, text[], text)
  FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_nutzer_synchronisieren(text, text, text, text, text, boolean, text[], text)
  TO reziproq_api;--> statement-breakpoint

-- Die eigene Sprache ändern. Nur reziproq_api darf sie ausführen, und nur für die angemeldete
-- Person (p_id kommt aus dem geprüften Token). Andere Werte als de und en scheitern am Check.
CREATE FUNCTION app_sprache_setzen(p_id text, p_locale text) RETURNS void
  LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ UPDATE app_user SET locale = p_locale, updated_at = now() WHERE id = p_id $$;--> statement-breakpoint
ALTER FUNCTION app_sprache_setzen(text, text) OWNER TO reziproq_anmeldung;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_sprache_setzen(text, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_sprache_setzen(text, text) TO reziproq_api;
--> statement-breakpoint

-- Die gespeicherte Sprache für /me; leer gilt als Deutsch.
CREATE FUNCTION app_sprache_des_nutzers(p_id text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT coalesce((SELECT u.locale FROM app_user u WHERE u.id = p_id), 'de') $$;--> statement-breakpoint
ALTER FUNCTION app_sprache_des_nutzers(text) OWNER TO reziproq_anmeldung;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_sprache_des_nutzers(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_sprache_des_nutzers(text) TO reziproq_api;
