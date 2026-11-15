CREATE TABLE "comment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"object_type" text NOT NULL,
	"object_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"mentions" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "comment_object_type" CHECK ("comment"."object_type" in ('initiative', 'commitment', 'action', 'meeting', 'topic', 'rule_set')),
	CONSTRAINT "comment_body" CHECK (("comment"."deleted_at" is null and length(trim("comment"."body")) between 1 and 2000)
        or ("comment"."deleted_at" is not null and "comment"."body" = ''))
);
--> statement-breakpoint
CREATE TABLE "comment_mention" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"comment_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"opened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_mention_je_person" UNIQUE("comment_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "outbox_event" DROP CONSTRAINT "outbox_event_email_payload";--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_mention" ADD CONSTRAINT "comment_mention_comment_id_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_mention" ADD CONSTRAINT "comment_mention_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_mention" ADD CONSTRAINT "comment_mention_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_object" ON "comment" USING btree ("object_type","object_id","created_at");--> statement-breakpoint
CREATE INDEX "comment_relationship" ON "comment" USING btree ("relationship_id");--> statement-breakpoint
CREATE INDEX "comment_mention_user" ON "comment_mention" USING btree ("user_id","opened_at");--> statement-breakpoint
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_email_payload" CHECK ((
        ("outbox_event"."email_template" IS NULL AND "outbox_event"."email_locale" IS NULL
          AND "outbox_event"."email_recipient" IS NULL AND "outbox_event"."email_first_name" IS NULL
          AND "outbox_event"."email_title" IS NULL AND "outbox_event"."email_deadline" IS NULL
          AND "outbox_event"."email_link" IS NULL AND "outbox_event"."email_sender" IS NULL
          AND "outbox_event"."email_message" IS NULL)
        OR
        ("outbox_event"."email_template" IS NOT NULL
          AND "outbox_event"."email_template" IN (
            'invitation', 'reminder', 'approval', 'escalation', 'supplier_invitation', 'survey',
            'mention'
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
SELECT app_apply_layer('comment', 'shared');--> statement-breakpoint
SELECT app_apply_layer('comment_mention', 'org_private');--> statement-breakpoint

-- QS-02: Erwähnte Personen bekommen eine Mail mit Titel und Link, nie mit dem Kommentartext, und
-- einen Eintrag auf Start. Die Person kann zur anderen Seite gehören; deren Adresse und Erwähnung
-- liegen außerhalb der eigenen Ebene. Darum läuft das als eigene, enge Rolle: Sie liest nur den
-- eigenen, frisch geschriebenen Kommentar, das Team der Beziehung und die Adresse genau dieser
-- Person, und sie legt nur Erwähnung, Verlauf und Mail an. Erwähnen darf nur, wer den Kommentar
-- verfasst hat. Bei internen Kommentaren nur Personen der eigenen Seite, bei geteilten zusätzlich
-- geteilte Teammitglieder der anderen Seite.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'reziproq_kommentar') THEN
    CREATE ROLE reziproq_kommentar NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;--> statement-breakpoint
GRANT reziproq_kommentar TO CURRENT_USER;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO reziproq_kommentar;--> statement-breakpoint
GRANT SELECT ON "comment", relationship, relationship_member, app_user TO reziproq_kommentar;--> statement-breakpoint
GRANT INSERT ON comment_mention, audit_event, outbox_event TO reziproq_kommentar;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_is_relationship_party(uuid), app_is_relationship_buyer(uuid),
  app_is_relationship_supplier(uuid), app_can_see_relationship(uuid),
  app_relationship_customer_ok(uuid), app_current_organization_id(), app_current_user_id()
  TO reziproq_kommentar;--> statement-breakpoint
CREATE POLICY comment_erwaehnen ON "comment" FOR SELECT TO reziproq_kommentar
  USING (deleted_at IS NULL);--> statement-breakpoint
CREATE POLICY relationship_erwaehnen ON relationship FOR SELECT TO reziproq_kommentar
  USING (true);--> statement-breakpoint
CREATE POLICY relationship_member_erwaehnen ON relationship_member FOR SELECT TO reziproq_kommentar
  USING (true);--> statement-breakpoint
CREATE POLICY app_user_erwaehnen ON app_user FOR SELECT TO reziproq_kommentar
  USING (true);--> statement-breakpoint
CREATE POLICY comment_mention_erwaehnen ON comment_mention FOR INSERT TO reziproq_kommentar
  WITH CHECK (true);--> statement-breakpoint
CREATE POLICY audit_event_erwaehnen ON audit_event FOR INSERT TO reziproq_kommentar
  WITH CHECK (object_type = 'comment_mention');--> statement-breakpoint
CREATE POLICY outbox_event_erwaehnen ON outbox_event FOR INSERT TO reziproq_kommentar
  WITH CHECK (email_template = 'mention');--> statement-breakpoint

CREATE FUNCTION app_kommentar_erwaehnen(
  p_comment_id uuid,
  p_user_id text,
  p_title text,
  p_path_buyer text,
  p_path_supplier text
) RETURNS boolean
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  c record;
  rel record;
  member record;
  person record;
  v_mention uuid;
  v_event uuid;
BEGIN
  SELECT id, relationship_id, owner_org_id, visibility, author_id, author_name INTO c
  FROM "comment" WHERE id = p_comment_id;
  IF c.id IS NULL
    OR c.owner_org_id IS DISTINCT FROM app_current_organization_id()
    OR c.author_id IS DISTINCT FROM app_current_user_id()
    OR NOT app_is_relationship_party(c.relationship_id) THEN
    RAISE EXCEPTION 'comment_not_found';
  END IF;
  SELECT buyer_org_id INTO rel FROM relationship WHERE id = c.relationship_id;
  SELECT m.org_id INTO member FROM relationship_member m
  WHERE m.relationship_id = c.relationship_id
    AND m.user_id = p_user_id
    AND (m.org_id = c.owner_org_id OR (c.visibility = 'shared' AND m.visibility = 'shared'))
  LIMIT 1;
  IF member.org_id IS NULL THEN
    RAISE EXCEPTION 'mention_not_allowed';
  END IF;
  SELECT u.email, u.locale, u.given_name, u.name INTO person FROM app_user u
  WHERE u.id = p_user_id AND u.organization_id = member.org_id;
  IF person.email IS NULL THEN
    RAISE EXCEPTION 'mention_not_allowed';
  END IF;

  -- IDs vorab, damit die Rolle Erwähnung und Verlauf nicht lesen muss (kein RETURNING).
  IF EXISTS (
    SELECT 1 FROM "comment" WHERE id = c.id AND p_user_id = ANY (mentions)
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'mention_not_in_comment';
  END IF;
  v_mention := uuidv7();
  INSERT INTO comment_mention (id, comment_id, relationship_id, org_id, user_id)
  VALUES (v_mention, c.id, c.relationship_id, member.org_id, p_user_id);
  v_event := uuidv7();
  INSERT INTO audit_event (
    id, actor_user_id, actor_name, owner_org_id, visibility, relationship_id,
    object_type, object_id, action, changes
  )
  VALUES (
    v_event, c.author_id, c.author_name, c.owner_org_id, c.visibility, c.relationship_id,
    'comment_mention', c.id::text, 'created',
    jsonb_build_object('user_id', jsonb_build_object('from', null, 'to', p_user_id))
  );
  INSERT INTO outbox_event (
    event_type, object_type, object_id, audit_event_id, org_id, email_template, email_locale,
    email_recipient, email_first_name, email_title, email_link
  )
  VALUES (
    'email.mention', 'comment_mention', v_mention::text, v_event, c.owner_org_id, 'mention',
    coalesce(person.locale, 'de'), person.email,
    coalesce(person.given_name, split_part(person.name, ' ', 1)), p_title,
    CASE WHEN member.org_id = rel.buyer_org_id THEN p_path_buyer ELSE p_path_supplier END
  );
  RETURN true;
END
$$;--> statement-breakpoint
ALTER FUNCTION app_kommentar_erwaehnen(uuid, text, text, text, text)
  OWNER TO reziproq_kommentar;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_kommentar_erwaehnen(uuid, text, text, text, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_kommentar_erwaehnen(uuid, text, text, text, text) TO reziproq_app;
