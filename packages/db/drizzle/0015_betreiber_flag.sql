ALTER TABLE "app_user" ADD COLUMN "is_operator" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- UMB-01: Betreiber-Zugang nach dem neuen Muster. Wer Betreiber ist, steht in der Datenbank
-- (is_operator, gesetzt per pnpm operator:set); die Zitadel-Rolle betreiber zählt nicht mehr.

-- 1. Protokoll umbenennen, ohne Einträge zu verlieren ------------------------------------------

ALTER TABLE "betreiber_zugriff" RENAME TO "support_access_log";--> statement-breakpoint
ALTER TABLE "support_access_log" RENAME COLUMN "nutzer_id" TO "user_id";--> statement-breakpoint
ALTER TABLE "support_access_log" RENAME COLUMN "aktion" TO "action";--> statement-breakpoint
ALTER TABLE "support_access_log" RENAME COLUMN "zeitpunkt" TO "occurred_at";--> statement-breakpoint
ALTER TABLE "support_access_log" RENAME CONSTRAINT "betreiber_zugriff_pkey" TO "support_access_log_pkey";--> statement-breakpoint
ALTER TABLE "support_access_log" RENAME CONSTRAINT "betreiber_zugriff_organization_id_organization_id_fk"
  TO "support_access_log_organization_id_organization_id_fk";--> statement-breakpoint
ALTER POLICY "betreiber_zugriff_anmeldung" ON "support_access_log" RENAME TO "support_access_log_anmeldung";--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_betreiber_protokoll(p_nutzer_id text, p_organization_id uuid, p_aktion text)
  RETURNS void
  LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    INSERT INTO support_access_log (user_id, organization_id, action)
    VALUES (p_nutzer_id, p_organization_id, p_aktion)
  $$;--> statement-breakpoint

-- 2. Betreiber erkennen, auch ohne eigene Organisation ------------------------------------------

CREATE FUNCTION app_ist_betreiber(p_id text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$ SELECT coalesce((SELECT u.is_operator FROM app_user u WHERE u.id = p_id), false) $$;--> statement-breakpoint
ALTER FUNCTION app_ist_betreiber(text) OWNER TO reziproq_anmeldung;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_ist_betreiber(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_ist_betreiber(text) TO reziproq_api;
