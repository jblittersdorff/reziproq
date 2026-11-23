-- IN-01: Der Job, der Zugangsdaten vor Ablauf erneuert, arbeitet je Kunde in dessen Mandanten-Session.
-- Die Funktion nennt nur die IDs der Organisationen mit aktiven Verbindungen, keine Inhalte; sie läuft
-- als die enge Rolle der Webhook-Suche, die dafür nur org_id und status von connection lesen darf.
GRANT SELECT ("org_id", "status") ON "connection" TO reziproq_hook_lookup;--> statement-breakpoint
CREATE POLICY connection_lookup ON "connection" FOR SELECT TO reziproq_hook_lookup USING (true);--> statement-breakpoint
CREATE FUNCTION app_connection_orgs()
  RETURNS TABLE (org_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
  SELECT DISTINCT c.org_id FROM connection c WHERE c.status = 'active' ORDER BY 1
$$;--> statement-breakpoint
ALTER FUNCTION app_connection_orgs() OWNER TO reziproq_hook_lookup;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_connection_orgs() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_connection_orgs() TO reziproq_api;--> statement-breakpoint
-- Eingehende Webhooks kommen ohne Login, also ohne Mandanten-Session: Suche über die API-Rolle
GRANT EXECUTE ON FUNCTION app_inbound_hook(text) TO reziproq_api;
