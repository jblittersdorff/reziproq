CREATE TABLE "plan_approval" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"user_id" text NOT NULL,
	"user_name" text NOT NULL,
	"role" text NOT NULL,
	"decision" text NOT NULL,
	"comment" text,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_approval_once" UNIQUE("plan_id","round","user_id"),
	CONSTRAINT "plan_approval_role" CHECK ("plan_approval"."role" in ('sro', 'sponsor')),
	CONSTRAINT "plan_approval_decision" CHECK ("plan_approval"."decision" in ('approved', 'returned')),
	CONSTRAINT "plan_approval_reason" CHECK ("plan_approval"."decision" = 'approved' or length(trim(coalesce("plan_approval"."comment", ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "supplier_plan" ADD COLUMN "review_round" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_plan" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "supplier_plan" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "plan_approval" ADD CONSTRAINT "plan_approval_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_approval" ADD CONSTRAINT "plan_approval_plan_relationship_fk" FOREIGN KEY ("plan_id","relationship_id") REFERENCES "public"."supplier_plan"("id","relationship_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
SELECT app_apply_layer('plan_approval', 'buyer_private');--> statement-breakpoint

-- SPL-07: Nur ein Entwurf ändert sich. In Freigabe, freigegeben oder abgelöst bleibt der Inhalt,
-- wie er ist; ändern heißt eine neue Version anlegen. Läuft mit den Rechten der aufrufenden Rolle.
CREATE FUNCTION app_plan_content_locked() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  v_plan uuid := coalesce(NEW.plan_id, OLD.plan_id);
BEGIN
  IF EXISTS (SELECT 1 FROM supplier_plan p WHERE p.id = v_plan AND p.status <> 'draft') THEN
    RAISE EXCEPTION 'plan_locked';
  END IF;
  RETURN coalesce(NEW, OLD);
END
$$;--> statement-breakpoint
CREATE TRIGGER plan_objective_locked BEFORE INSERT OR UPDATE OR DELETE ON plan_objective
  FOR EACH ROW EXECUTE FUNCTION app_plan_content_locked();--> statement-breakpoint
CREATE TRIGGER strategic_topic_locked BEFORE INSERT OR UPDATE OR DELETE ON strategic_topic
  FOR EACH ROW EXECUTE FUNCTION app_plan_content_locked();--> statement-breakpoint

CREATE FUNCTION app_plan_summary_locked() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF OLD.status <> 'draft' AND NEW.summary IS DISTINCT FROM OLD.summary THEN
    RAISE EXCEPTION 'plan_locked';
  END IF;
  IF OLD.status IN ('approved', 'superseded') AND NEW.status NOT IN ('approved', 'superseded') THEN
    RAISE EXCEPTION 'plan_locked';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER supplier_plan_locked BEFORE UPDATE ON supplier_plan
  FOR EACH ROW EXECUTE FUNCTION app_plan_summary_locked();
