-- IN-02: Die neuen Angaben der Anmelde-Funktion sind optional, damit Aufrufe ohne Firmenanmeldung
-- (Betrieb, Werkzeuge, ältere Tests) unverändert bleiben.
CREATE OR REPLACE FUNCTION app_nutzer_synchronisieren(
  p_id text, p_name text, p_given_name text, p_email text, p_zitadel_org_id text,
  p_anmeldung boolean, p_token_roles text[], p_browser_locale text,
  p_default_role text DEFAULT NULL, p_pending boolean DEFAULT NULL,
  p_identity_provider text DEFAULT NULL, p_identity_subject text DEFAULT NULL
) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
BEGIN
  INSERT INTO app_user (
    id, name, given_name, email, organization_id, last_login_at,
    org_role, is_controlling, roles_imported_at, locale, approval_pending
  )
  VALUES (
    p_id, p_name, p_given_name, p_email,
    (SELECT o.id FROM organization o WHERE o.zitadel_org_id = p_zitadel_org_id),
    CASE WHEN p_anmeldung THEN now() END,
    coalesce(p_default_role, CASE
      WHEN 'admin' = ANY (p_token_roles) THEN 'admin'
      WHEN 'nutzer' = ANY (p_token_roles) THEN 'member'
      ELSE 'viewer'
    END),
    CASE WHEN p_default_role IS NULL THEN coalesce('controlling' = ANY (p_token_roles), false)
      ELSE false END,
    now(),
    CASE WHEN p_anmeldung THEN p_browser_locale END,
    coalesce(p_pending, false)
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
    updated_at = now();
  IF p_identity_provider IS NOT NULL AND p_identity_subject IS NOT NULL THEN
    INSERT INTO user_identity (user_id, provider, subject, email, last_login_at)
    VALUES (p_id, p_identity_provider, p_identity_subject, p_email, now())
    ON CONFLICT (provider, subject) DO UPDATE SET email = excluded.email, last_login_at = now()
      WHERE user_identity.user_id = excluded.user_id;
  END IF;
END
  $$;
