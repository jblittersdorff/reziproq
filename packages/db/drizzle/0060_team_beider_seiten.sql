-- PLB-04: Das Team je Beziehung wird geteilt mit Sichtbarkeit je Person. Bestehende Teams bleiben
-- vollständig: owner_org_id = org_id, SRO und Sponsoren geteilt, alle anderen intern.
ALTER TABLE "relationship_member" ADD COLUMN "owner_org_id" uuid;--> statement-breakpoint
ALTER TABLE "relationship_member" ADD COLUMN "visibility" text DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE "relationship_member" ADD COLUMN "member_name" text;--> statement-breakpoint
ALTER TABLE "relationship_member" ADD CONSTRAINT "relationship_member_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "relationship_member" m SET
  owner_org_id = m.org_id,
  visibility = CASE WHEN m.team_role IN ('sro', 'sponsor') THEN 'shared' ELSE 'internal' END,
  member_name = (SELECT u.name FROM app_user u WHERE u.id = m.user_id);--> statement-breakpoint
ALTER TABLE "relationship_member" ADD CONSTRAINT "relationship_member_owner" CHECK ("relationship_member"."owner_org_id" is not null and "relationship_member"."owner_org_id" = "relationship_member"."org_id");--> statement-breakpoint
-- Seite und Name füllt ein Trigger, damit bestehende Schreibwege (Annahme einer Einladung, PLT-05)
-- unverändert bleiben. Er läuft als reziproq_team: nur Name und ID aus app_user.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'reziproq_team') THEN
    CREATE ROLE reziproq_team NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint
GRANT reziproq_team TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_team;--> statement-breakpoint
GRANT SELECT ("id", "name") ON "app_user" TO reziproq_team;--> statement-breakpoint
CREATE POLICY app_user_team ON "app_user" FOR SELECT TO reziproq_team USING (true);--> statement-breakpoint
CREATE FUNCTION app_team_member_fill() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
BEGIN
  NEW.owner_org_id := coalesce(NEW.owner_org_id, NEW.org_id);
  NEW.org_id := coalesce(NEW.org_id, NEW.owner_org_id);
  IF NEW.member_name IS NULL OR (TG_OP = 'UPDATE' AND NEW.user_id <> OLD.user_id) THEN
    SELECT u.name INTO NEW.member_name FROM app_user u WHERE u.id = NEW.user_id;
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
ALTER FUNCTION app_team_member_fill() OWNER TO reziproq_team;--> statement-breakpoint
CREATE TRIGGER "relationship_member_fill"
  BEFORE INSERT OR UPDATE ON "relationship_member"
  FOR EACH ROW EXECUTE FUNCTION app_team_member_fill();--> statement-breakpoint
-- Von org_private auf geteilt: alte Policies weg, neue über app_apply_layer.
DROP POLICY IF EXISTS "relationship_member_org_private" ON "relationship_member";--> statement-breakpoint
DROP POLICY IF EXISTS "relationship_member_customer" ON "relationship_member";--> statement-breakpoint
SELECT app_apply_layer('relationship_member', 'shared');
