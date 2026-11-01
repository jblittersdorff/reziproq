CREATE TABLE "relationship_member" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"team_role" text DEFAULT 'member' NOT NULL,
	"function" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relationship_member_je_person" UNIQUE("relationship_id","org_id","user_id"),
	CONSTRAINT "relationship_member_team_role" CHECK ("relationship_member"."team_role" in ('sro', 'sponsor', 'member', 'viewer')),
	CONSTRAINT "relationship_member_function" CHECK ("relationship_member"."function" in ('purchasing', 'quality', 'engineering', 'logistics', 'programs', 'after_sales'))
);
--> statement-breakpoint
ALTER TABLE "relationship_member" ADD CONSTRAINT "relationship_member_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_member" ADD CONSTRAINT "relationship_member_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_member" ADD CONSTRAINT "relationship_member_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "relationship_member_ein_sro" ON "relationship_member" USING btree ("relationship_id","org_id") WHERE "relationship_member"."team_role" = 'sro';--> statement-breakpoint

-- PLT-05b: Team je Beziehung, intern je Organisation (org_private).
SELECT app_apply_layer('relationship_member', 'org_private');--> statement-breakpoint

-- Höchstens zwei Sponsoren je Beziehung und Organisation; höchstens einen SRO sichert der
-- eindeutige Index relationship_member_ein_sro.
CREATE FUNCTION app_hoechstens_zwei_sponsoren() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF NEW.team_role = 'sponsor' AND (
    SELECT count(*) FROM relationship_member m
    WHERE m.relationship_id = NEW.relationship_id AND m.org_id = NEW.org_id
      AND m.team_role = 'sponsor' AND m.id <> NEW.id
  ) >= 2 THEN
    RAISE EXCEPTION 'Höchstens zwei Sponsoren je Beziehung' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER "relationship_member_sponsoren"
  BEFORE INSERT OR UPDATE OF team_role ON "relationship_member"
  FOR EACH ROW EXECUTE FUNCTION app_hoechstens_zwei_sponsoren();
