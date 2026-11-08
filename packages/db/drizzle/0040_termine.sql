CREATE TABLE "meeting" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"type" text NOT NULL,
	"rule_set_item_id" uuid,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"location" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"protocol" text,
	"created_by" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_type" CHECK ("meeting"."type" in ('quarterly_review', 'strategy_dialogue', 'jbp', 'format', 'other')),
	CONSTRAINT "meeting_status" CHECK ("meeting"."status" in ('planned', 'held', 'closed')),
	CONSTRAINT "meeting_title" CHECK (length(trim("meeting"."title")) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "meeting_agenda_item" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"title" text NOT NULL,
	"position" integer NOT NULL,
	"linked_object_type" text,
	"linked_object_id" uuid
);
--> statement-breakpoint
CREATE TABLE "meeting_decision" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"text" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meeting_note" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"text" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meeting_note_per_org" UNIQUE("meeting_id","org_id")
);
--> statement-breakpoint
CREATE TABLE "meeting_participant" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_rule_set_item_id_rule_set_item_id_fk" FOREIGN KEY ("rule_set_item_id") REFERENCES "public"."rule_set_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_agenda_item" ADD CONSTRAINT "meeting_agenda_item_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_agenda_item" ADD CONSTRAINT "meeting_agenda_item_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_agenda_item" ADD CONSTRAINT "meeting_agenda_item_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_decision" ADD CONSTRAINT "meeting_decision_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_decision" ADD CONSTRAINT "meeting_decision_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_decision" ADD CONSTRAINT "meeting_decision_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_note" ADD CONSTRAINT "meeting_note_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_note" ADD CONSTRAINT "meeting_note_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_note" ADD CONSTRAINT "meeting_note_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participant" ADD CONSTRAINT "meeting_participant_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participant" ADD CONSTRAINT "meeting_participant_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_participant" ADD CONSTRAINT "meeting_participant_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_relationship" ON "meeting" USING btree ("relationship_id","starts_at");--> statement-breakpoint
CREATE INDEX "meeting_agenda_item_meeting" ON "meeting_agenda_item" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "meeting_decision_meeting" ON "meeting_decision" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "meeting_participant_meeting" ON "meeting_participant" USING btree ("meeting_id");--> statement-breakpoint
-- QBR-01a: Termine und ihre Teile sind geteilt; Notizen gehören einer Seite allein.
SELECT app_apply_layer('meeting', 'shared');--> statement-breakpoint
SELECT app_apply_layer('meeting_participant', 'shared');--> statement-breakpoint
SELECT app_apply_layer('meeting_agenda_item', 'shared');--> statement-breakpoint
SELECT app_apply_layer('meeting_decision', 'shared');--> statement-breakpoint
SELECT app_apply_layer('meeting_note', 'org_private');--> statement-breakpoint

-- Ein abgeschlossener Termin ist gesperrt: kein Agendapunkt, kein Beschluss, kein Protokoll ändert
-- sich mehr (QBR-01b schließt ab). Läuft mit den Rechten der aufrufenden Rolle; den Termin sieht sie.
CREATE FUNCTION app_meeting_locked() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_meeting uuid := coalesce(NEW.meeting_id, OLD.meeting_id);
BEGIN
  IF EXISTS (SELECT 1 FROM meeting m WHERE m.id = v_meeting AND m.status = 'closed') THEN
    RAISE EXCEPTION 'meeting_closed';
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;--> statement-breakpoint
CREATE TRIGGER meeting_agenda_item_locked BEFORE INSERT OR UPDATE OR DELETE ON meeting_agenda_item
  FOR EACH ROW EXECUTE FUNCTION app_meeting_locked();--> statement-breakpoint
CREATE TRIGGER meeting_decision_locked BEFORE INSERT OR UPDATE OR DELETE ON meeting_decision
  FOR EACH ROW EXECUTE FUNCTION app_meeting_locked();--> statement-breakpoint
CREATE TRIGGER meeting_participant_locked BEFORE INSERT OR UPDATE OR DELETE ON meeting_participant
  FOR EACH ROW EXECUTE FUNCTION app_meeting_locked();--> statement-breakpoint

CREATE FUNCTION app_meeting_closed_unchanged() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF OLD.status = 'closed' THEN
    RAISE EXCEPTION 'meeting_closed';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER meeting_closed_unchanged BEFORE UPDATE ON meeting
  FOR EACH ROW EXECUTE FUNCTION app_meeting_closed_unchanged();
