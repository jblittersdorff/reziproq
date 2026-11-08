CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"message" text,
	"token_hash" text NOT NULL,
	"invited_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_user_id" text,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "invitation_token_hash" UNIQUE("token_hash"),
	CONSTRAINT "invitation_role" CHECK ("invitation"."role" in ('admin', 'member')),
	CONSTRAINT "invitation_token_hash_form" CHECK ("invitation"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "invitation_message_length" CHECK (length("invitation"."message") <= 500),
	CONSTRAINT "invitation_accepted_or_revoked" CHECK ("invitation"."accepted_at" IS NULL OR "invitation"."revoked_at" IS NULL)
);
--> statement-breakpoint
ALTER TABLE "outbox_event" DROP CONSTRAINT "outbox_event_email_payload";--> statement-breakpoint
ALTER TABLE "outbox_event" ADD COLUMN "email_sender" text;--> statement-breakpoint
ALTER TABLE "outbox_event" ADD COLUMN "email_message" text;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_invited_by_app_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_accepted_user_id_app_user_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitation_relationship" ON "invitation" USING btree ("relationship_id");--> statement-breakpoint
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_email_payload" CHECK ((
        ("outbox_event"."email_template" IS NULL AND "outbox_event"."email_locale" IS NULL
          AND "outbox_event"."email_recipient" IS NULL AND "outbox_event"."email_first_name" IS NULL
          AND "outbox_event"."email_title" IS NULL AND "outbox_event"."email_deadline" IS NULL
          AND "outbox_event"."email_link" IS NULL AND "outbox_event"."email_sender" IS NULL
          AND "outbox_event"."email_message" IS NULL)
        OR
        ("outbox_event"."email_template" IS NOT NULL
          AND "outbox_event"."email_template" IN (
            'invitation', 'reminder', 'approval', 'escalation', 'supplier_invitation'
          )
          AND "outbox_event"."email_locale" IS NOT NULL
          AND "outbox_event"."email_locale" IN ('de', 'en')
          AND "outbox_event"."email_recipient" IS NOT NULL
          AND length(trim("outbox_event"."email_recipient")) > 0
          AND "outbox_event"."email_title" IS NOT NULL
          AND length(trim("outbox_event"."email_title")) > 0
          AND "outbox_event"."email_link" IS NOT NULL
          AND "outbox_event"."email_link" LIKE '/%'
          AND "outbox_event"."email_link" NOT LIKE '//%'
          AND position('?' in "outbox_event"."email_link") = 0
          AND position('#' in "outbox_event"."email_link") = 0
          AND position(chr(92) in "outbox_event"."email_link") = 0)
      ));--> statement-breakpoint

-- LIF-01a: Die Einladung ist org_private der einladenden Organisation.
SELECT app_apply_layer('invitation', 'org_private');--> statement-breakpoint

-- Annahme ohne Login. Die Funktionen laufen als reziproq_einladung: keine Anmeldung, kein
-- BYPASSRLS, nur die Spalten und Tabellen, die eine Annahme lesen oder schreiben muss. Nur
-- reziproq_api darf sie ausführen. Der Token selbst erreicht die Datenbank nie, nur sein SHA-256.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reziproq_einladung') THEN
    CREATE ROLE reziproq_einladung NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint
GRANT reziproq_einladung TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_einladung;--> statement-breakpoint

GRANT SELECT ON invitation TO reziproq_einladung;--> statement-breakpoint
GRANT UPDATE (accepted_at, accepted_user_id) ON invitation TO reziproq_einladung;--> statement-breakpoint
CREATE POLICY invitation_einladung_lesen ON invitation
  FOR SELECT TO reziproq_einladung USING (true);--> statement-breakpoint
CREATE POLICY invitation_einladung_annehmen ON invitation
  FOR UPDATE TO reziproq_einladung USING (true) WITH CHECK (true);--> statement-breakpoint

GRANT SELECT ON organization TO reziproq_einladung;--> statement-breakpoint
GRANT UPDATE (zitadel_org_id) ON organization TO reziproq_einladung;--> statement-breakpoint
CREATE POLICY organization_einladung_lesen ON organization
  FOR SELECT TO reziproq_einladung USING (true);--> statement-breakpoint
CREATE POLICY organization_einladung_verknuepfen ON organization
  FOR UPDATE TO reziproq_einladung USING (true) WITH CHECK (true);--> statement-breakpoint

GRANT SELECT ON relationship TO reziproq_einladung;--> statement-breakpoint
GRANT UPDATE (status) ON relationship TO reziproq_einladung;--> statement-breakpoint
CREATE POLICY relationship_einladung_lesen ON relationship
  FOR SELECT TO reziproq_einladung USING (true);--> statement-breakpoint
-- Sperren (FOR UPDATE) braucht auch aktive Beziehungen; schreiben lässt sich nur 'active'.
CREATE POLICY relationship_einladung_aktivieren ON relationship
  FOR UPDATE TO reziproq_einladung USING (status IN ('draft', 'active'))
  WITH CHECK (status = 'active');--> statement-breakpoint

GRANT SELECT, INSERT ON app_user TO reziproq_einladung;--> statement-breakpoint
GRANT UPDATE (name, organization_id, org_role, roles_imported_at, updated_at)
  ON app_user TO reziproq_einladung;--> statement-breakpoint
CREATE POLICY app_user_einladung ON app_user
  FOR ALL TO reziproq_einladung USING (true) WITH CHECK (true);--> statement-breakpoint

GRANT SELECT, INSERT ON relationship_member TO reziproq_einladung;--> statement-breakpoint
GRANT UPDATE (team_role) ON relationship_member TO reziproq_einladung;--> statement-breakpoint
CREATE POLICY relationship_member_einladung ON relationship_member
  FOR ALL TO reziproq_einladung USING (true) WITH CHECK (true);--> statement-breakpoint

GRANT INSERT ON audit_event, outbox_event TO reziproq_einladung;--> statement-breakpoint
CREATE POLICY audit_event_einladung ON audit_event
  FOR INSERT TO reziproq_einladung WITH CHECK (object_type = 'relationship');--> statement-breakpoint
CREATE POLICY outbox_event_einladung ON outbox_event
  FOR INSERT TO reziproq_einladung WITH CHECK (email_template IS NULL);--> statement-breakpoint

-- Was die Seite /einladung/<token> zeigen darf, plus die Daten, die die API für Zitadel braucht.
-- status: open, expired, used (schon angenommen) oder revoked (zurückgezogen, Beziehung beendet).
CREATE FUNCTION app_einladung_lesen(p_token_hash text)
RETURNS TABLE (
  status text, customer text, sro text, supplier text, supplier_org_id uuid,
  zitadel_org_id text, email text, expires_at timestamptz, kam_taken boolean
)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT
      CASE
        WHEN i.accepted_at IS NOT NULL THEN 'used'
        WHEN i.revoked_at IS NOT NULL OR r.status = 'ended' THEN 'revoked'
        WHEN i.expires_at <= now() THEN 'expired'
        ELSE 'open'
      END,
      b.name,
      (SELECT u.name FROM relationship_member m JOIN app_user u ON u.id = m.user_id
        WHERE m.relationship_id = r.id AND m.org_id = r.buyer_org_id AND m.team_role = 'sro'),
      s.name, s.id, s.zitadel_org_id, i.email, i.expires_at,
      EXISTS (SELECT 1 FROM relationship_member m
        WHERE m.relationship_id = r.id AND m.org_id = r.supplier_org_id AND m.team_role = 'sro')
    FROM invitation i
    JOIN relationship r ON r.id = i.relationship_id
    JOIN organization b ON b.id = r.buyer_org_id
    JOIN organization s ON s.id = r.supplier_org_id
    WHERE i.token_hash = p_token_hash
  $$;--> statement-breakpoint
ALTER FUNCTION app_einladung_lesen(text) OWNER TO reziproq_einladung;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_einladung_lesen(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_einladung_lesen(text) TO reziproq_api;--> statement-breakpoint

-- Annahme in einer Transaktion: Zitadel-Organisation verknüpfen, Person anlegen (die erste der
-- Organisation wird Admin), ins Team der Lieferantenseite aufnehmen, Beziehung aktivieren,
-- Einladung verbrauchen. Fehler als Text: invitation_not_found, invitation_unavailable,
-- invitation_team_role, invitation_kam_taken, invitation_user_other_org, invitation_zitadel_mismatch.
CREATE FUNCTION app_einladung_annehmen(
  p_token_hash text, p_user_id text, p_name text, p_given_name text, p_email text,
  p_zitadel_org_id text, p_team_role text, p_locale text
) RETURNS TABLE (org_role text, relationship_id uuid)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
#variable_conflict use_column
DECLARE
  inv invitation%ROWTYPE;
  rel relationship%ROWTYPE;
  supplier organization%ROWTYPE;
  existing app_user%ROWTYPE;
  v_role text;
  v_event uuid;
BEGIN
  IF p_team_role IS NULL OR p_team_role NOT IN ('sro', 'sponsor', 'member') THEN
    RAISE EXCEPTION 'invitation_team_role';
  END IF;
  SELECT * INTO inv FROM invitation i WHERE i.token_hash = p_token_hash FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_not_found'; END IF;
  SELECT * INTO rel FROM relationship r WHERE r.id = inv.relationship_id FOR UPDATE;
  -- Eine beendete Beziehung ist für diese Rolle nicht sperrbar und fehlt hier.
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation_unavailable'; END IF;
  IF inv.accepted_at IS NOT NULL OR inv.revoked_at IS NOT NULL OR inv.expires_at <= now()
    OR rel.status = 'ended' THEN
    RAISE EXCEPTION 'invitation_unavailable';
  END IF;

  -- Sperrt die Lieferantenorganisation: Zwei gleichzeitige Annahmen machen nicht beide zum Admin.
  SELECT * INTO supplier FROM organization o WHERE o.id = rel.supplier_org_id FOR UPDATE;
  IF supplier.zitadel_org_id IS NULL THEN
    UPDATE organization SET zitadel_org_id = p_zitadel_org_id WHERE id = supplier.id;
  ELSIF supplier.zitadel_org_id <> p_zitadel_org_id THEN
    RAISE EXCEPTION 'invitation_zitadel_mismatch';
  END IF;

  SELECT * INTO existing FROM app_user u WHERE u.id = p_user_id FOR UPDATE;
  IF FOUND THEN
    IF existing.organization_id IS NOT NULL AND existing.organization_id <> supplier.id THEN
      RAISE EXCEPTION 'invitation_user_other_org';
    END IF;
    v_role := CASE
      WHEN existing.organization_id = supplier.id THEN existing.org_role
      WHEN NOT EXISTS (SELECT 1 FROM app_user u WHERE u.organization_id = supplier.id) THEN 'admin'
      ELSE inv.role
    END;
    UPDATE app_user SET
      name = p_name, organization_id = supplier.id, org_role = v_role,
      roles_imported_at = coalesce(roles_imported_at, now()), updated_at = now()
    WHERE id = p_user_id;
  ELSE
    v_role := CASE
      WHEN EXISTS (SELECT 1 FROM app_user u WHERE u.organization_id = supplier.id) THEN inv.role
      ELSE 'admin'
    END;
    -- roles_imported_at gesetzt: Der erste Login übernimmt keine Rollen aus dem Token.
    INSERT INTO app_user (id, name, given_name, email, organization_id, org_role, roles_imported_at, locale)
    VALUES (p_user_id, p_name, p_given_name, p_email, supplier.id, v_role, now(), p_locale);
  END IF;

  IF p_team_role = 'sro' AND EXISTS (
    SELECT 1 FROM relationship_member m
    WHERE m.relationship_id = rel.id AND m.org_id = supplier.id AND m.team_role = 'sro'
      AND m.user_id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'invitation_kam_taken';
  END IF;
  INSERT INTO relationship_member (relationship_id, org_id, user_id, team_role)
  VALUES (rel.id, supplier.id, p_user_id, p_team_role)
  ON CONFLICT (relationship_id, org_id, user_id) DO UPDATE SET team_role = excluded.team_role;

  IF rel.status = 'draft' THEN
    UPDATE relationship SET status = 'active' WHERE id = rel.id;
    -- ID vorab, damit die Rolle den Verlauf nicht lesen muss (kein RETURNING).
    v_event := uuidv7();
    INSERT INTO audit_event (
      id, actor_user_id, actor_name, owner_org_id, visibility, relationship_id,
      object_type, object_id, action, changes
    )
    VALUES (
      v_event, p_user_id, p_name, supplier.id, 'shared', rel.id, 'relationship', rel.id::text, 'updated',
      jsonb_build_object('status', jsonb_build_object('from', 'draft', 'to', 'active'))
    );
    INSERT INTO outbox_event (event_type, object_type, object_id, audit_event_id, org_id)
    VALUES ('relationship.updated', 'relationship', rel.id::text, v_event, supplier.id);
  END IF;

  UPDATE invitation SET accepted_at = now(), accepted_user_id = p_user_id WHERE id = inv.id;
  RETURN QUERY SELECT v_role, rel.id;
END
$$;--> statement-breakpoint
ALTER FUNCTION app_einladung_annehmen(text, text, text, text, text, text, text, text)
  OWNER TO reziproq_einladung;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_einladung_annehmen(text, text, text, text, text, text, text, text)
  FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_einladung_annehmen(text, text, text, text, text, text, text, text)
  TO reziproq_api;
