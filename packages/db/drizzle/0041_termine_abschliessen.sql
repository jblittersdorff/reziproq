CREATE TABLE "meeting_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"frozen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meeting_snapshot" ADD CONSTRAINT "meeting_snapshot_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_snapshot" ADD CONSTRAINT "meeting_snapshot_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting_snapshot" ADD CONSTRAINT "meeting_snapshot_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_snapshot_meeting" ON "meeting_snapshot" USING btree ("meeting_id");--> statement-breakpoint
SELECT app_apply_layer('meeting_snapshot', 'shared');--> statement-breakpoint
-- Nur anfügen, wie audit_event: Die App darf den Stand weder ändern noch löschen.
REVOKE UPDATE, DELETE ON "meeting_snapshot" FROM reziproq_app;--> statement-breakpoint

-- Der eingefrorene Stand ändert sich nie (QBR-01b). Löschen geht nur mit dem Termin selbst
-- (ON DELETE CASCADE läuft eine Trigger-Ebene tiefer).
CREATE FUNCTION app_meeting_snapshot_frozen() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'meeting_snapshot_frozen';
  END IF;
  RETURN OLD;
END
$$;--> statement-breakpoint
CREATE TRIGGER meeting_snapshot_frozen BEFORE UPDATE OR DELETE ON meeting_snapshot
  FOR EACH ROW EXECUTE FUNCTION app_meeting_snapshot_frozen();
