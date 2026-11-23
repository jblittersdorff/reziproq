CREATE TABLE "org_sso" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"tenant_id" text,
	"hosted_domain" text,
	"domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_role" text DEFAULT 'viewer' NOT NULL,
	"password_login_allowed" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"idp_ref" text,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_sso_provider" UNIQUE("org_id","provider"),
	CONSTRAINT "org_sso_provider_check" CHECK ("org_sso"."provider" in ('entra', 'google')),
	CONSTRAINT "org_sso_status" CHECK ("org_sso"."status" in ('draft', 'active')),
	CONSTRAINT "org_sso_role" CHECK ("org_sso"."default_role" in ('admin', 'member', 'viewer')),
	CONSTRAINT "org_sso_ziel" CHECK (("org_sso"."provider" = 'entra') = ("org_sso"."tenant_id" is not null) and ("org_sso"."provider" = 'google') = ("org_sso"."hosted_domain" is not null))
);
--> statement-breakpoint
CREATE TABLE "user_identity" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"email" text NOT NULL,
	"last_login_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_identity_subject" UNIQUE("provider","subject")
);
--> statement-breakpoint
ALTER TABLE "app_user" ADD COLUMN "approval_pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "org_sso" ADD CONSTRAINT "org_sso_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identity" ADD CONSTRAINT "user_identity_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_identity_user" ON "user_identity" USING btree ("user_id");--> statement-breakpoint
SELECT app_apply_layer('org_sso', 'org_private');--> statement-breakpoint

-- IN-02: Externe Identitäten liest und schreibt nur die Anmelde-Rolle; über die Session nie.
ALTER TABLE "user_identity" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_identity" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "user_identity" TO reziproq_anmeldung;--> statement-breakpoint
CREATE POLICY "user_identity_anmeldung" ON "user_identity"
  FOR ALL TO reziproq_anmeldung USING (true) WITH CHECK (true);--> statement-breakpoint
GRANT SELECT ON "org_sso" TO reziproq_anmeldung;--> statement-breakpoint
CREATE POLICY "org_sso_anmeldung" ON "org_sso"
  FOR SELECT TO reziproq_anmeldung USING (true);--> statement-breakpoint

-- Freigabe neuer Personen durch Admins (Policy app_user_rollen_aendern aus 0013).
GRANT UPDATE (approval_pending) ON "app_user" TO reziproq_app;--> statement-breakpoint

-- Anmeldung über Microsoft oder Google der Organisation zu einer Zitadel-Organisation: nur die
-- Regeln und die bestätigten Domains, keine Inhalte.
CREATE FUNCTION app_sso_der_organisation(p_zitadel_org_id text)
  RETURNS TABLE (provider text, tenant_id text, hosted_domain text, domains text[],
    default_role text, password_login_allowed boolean)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT s.provider, s.tenant_id, s.hosted_domain,
      ARRAY(SELECT lower(d->>'domain') FROM jsonb_array_elements(s.domains) d
        WHERE d->>'verifiedAt' IS NOT NULL),
      s.default_role, s.password_login_allowed
    FROM org_sso s JOIN organization o ON o.id = s.org_id
    WHERE o.zitadel_org_id = p_zitadel_org_id AND s.status = 'active'
  $$;--> statement-breakpoint

-- Gehört eine bestätigte Domain zu einer Organisation mit SSO? Für die Anmeldeseite und die Sperre
-- der Anmeldung mit Passwort; nennt nur Anbieter und Regel.
CREATE FUNCTION app_sso_der_domain(p_domain text)
  RETURNS TABLE (provider text, password_login_allowed boolean, idp_ref text)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT s.provider, s.password_login_allowed, s.idp_ref FROM org_sso s
    WHERE s.status = 'active' AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(s.domains) d
      WHERE lower(d->>'domain') = lower(p_domain) AND d->>'verifiedAt' IS NOT NULL)
  $$;--> statement-breakpoint

-- Wem gehört eine externe Identität (Anbieter + Subject)?
CREATE FUNCTION app_identitaet(p_provider text, p_subject text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT user_id FROM user_identity WHERE provider = p_provider AND subject = p_subject $$;--> statement-breakpoint

DROP FUNCTION app_nutzer_synchronisieren(text, text, text, text, text, boolean, text[], text);--> statement-breakpoint
CREATE FUNCTION app_nutzer_synchronisieren(
  p_id text, p_name text, p_given_name text, p_email text, p_zitadel_org_id text,
  p_anmeldung boolean, p_token_roles text[], p_browser_locale text,
  p_default_role text, p_pending boolean, p_identity_provider text, p_identity_subject text
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
  $$;--> statement-breakpoint

DROP FUNCTION app_organisation_des_nutzers(text);--> statement-breakpoint
CREATE FUNCTION app_organisation_des_nutzers(p_id text)
  RETURNS TABLE (id uuid, name text, country text, buyer boolean, org_role text,
    is_controlling boolean, approval_pending boolean)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT o.id, o.name, o.country,
      EXISTS (SELECT 1 FROM organization_feature f WHERE f.organization_id = o.id AND f.feature = 'buyer'),
      u.org_role, u.is_controlling, u.approval_pending
    FROM app_user u JOIN organization o ON o.id = u.organization_id
    WHERE u.id = p_id
  $$;--> statement-breakpoint

ALTER FUNCTION app_sso_der_organisation(text) OWNER TO reziproq_anmeldung;--> statement-breakpoint
ALTER FUNCTION app_sso_der_domain(text) OWNER TO reziproq_anmeldung;--> statement-breakpoint
ALTER FUNCTION app_identitaet(text, text) OWNER TO reziproq_anmeldung;--> statement-breakpoint
ALTER FUNCTION app_nutzer_synchronisieren(text, text, text, text, text, boolean, text[], text, text, boolean, text, text)
  OWNER TO reziproq_anmeldung;--> statement-breakpoint
ALTER FUNCTION app_organisation_des_nutzers(text) OWNER TO reziproq_anmeldung;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_sso_der_organisation(text), app_sso_der_domain(text),
  app_identitaet(text, text),
  app_nutzer_synchronisieren(text, text, text, text, text, boolean, text[], text, text, boolean, text, text),
  app_organisation_des_nutzers(text)
  FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_sso_der_organisation(text), app_sso_der_domain(text),
  app_identitaet(text, text),
  app_nutzer_synchronisieren(text, text, text, text, text, boolean, text[], text, text, boolean, text, text),
  app_organisation_des_nutzers(text)
  TO reziproq_api;
