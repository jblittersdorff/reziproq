CREATE TABLE "commitment_private_source" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"commitment_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminder_sent" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"object_type" text NOT NULL,
	"object_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"due_date" date NOT NULL,
	"sent_at" timestamp with time zone DEFAULT app_now() NOT NULL,
	CONSTRAINT "reminder_sent_einmal" UNIQUE("org_id","object_type","object_id","kind","due_date"),
	CONSTRAINT "reminder_sent_kind" CHECK ("reminder_sent"."kind" in ('reminder', 'escalation')),
	CONSTRAINT "reminder_sent_object_type" CHECK ("reminder_sent"."object_type" in ('commitment', 'task'))
);
--> statement-breakpoint
ALTER TABLE "comment" DROP CONSTRAINT "comment_object_type";--> statement-breakpoint
ALTER TABLE "commitment_private_source" ADD CONSTRAINT "commitment_private_source_commitment_id_commitment_id_fk" FOREIGN KEY ("commitment_id") REFERENCES "public"."commitment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitment_private_source" ADD CONSTRAINT "commitment_private_source_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitment_private_source" ADD CONSTRAINT "commitment_private_source_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_sent" ADD CONSTRAINT "reminder_sent_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminder_sent" ADD CONSTRAINT "reminder_sent_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commitment_private_source_commitment" ON "commitment_private_source" USING btree ("commitment_id");--> statement-breakpoint
-- ZQ-01 (K2-a.3): Migration der Maßnahmen (E-K2-1). Jede geteilte Maßnahme wird genau eine Zusage,
-- jede interne genau eine Aufgabe, jeweils mit derselben ID (Verweise bleiben gültig, T2-ZQ1).
-- Danach hängen private Quellen, Versandlog, Kommentare und Fokus-Themen am neuen Objekt; 0144
-- entfernt die Tabellen der Maßnahmen.
SELECT app_apply_layer('commitment_private_source', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('reminder_sent', 'org_private');--> statement-breakpoint
-- Nur anfügen: was verschickt ist, bleibt verschickt (wie action_notification, 0063)
REVOKE UPDATE, DELETE ON "reminder_sent" FROM reziproq_app;--> statement-breakpoint

-- Status: erledigt wird gehalten (Beleg legacy, Regel 2), abgebrochen wird zurückgezogen, in
-- Arbeit bleibt offen. Quelle: Termin bleibt Termin, Feedback-Lücke wird feedback, Initiative
-- bleibt Initiative (mit initiative_id, wenn es sie noch gibt), sonst manual.
INSERT INTO "commitment" ("id", "relationship_id", "owner_org_id", "visibility", "jbp_id",
  "initiative_id", "side", "kind", "title", "description", "owner_user_id", "owner_name", "due_on",
  "status", "source_type", "source_ref", "fulfilled_evidence", "done_at", "created_by",
  "created_by_name", "created_at", "updated_at", "origin", "origin_run_id", "origin_user_id")
SELECT a.id, a.relationship_id, a.owner_org_id, 'shared', NULL,
  CASE WHEN a.source_type = 'initiative'
    AND EXISTS (SELECT 1 FROM initiative i WHERE i.id = a.source_id) THEN a.source_id END,
  a.owner_side, 'commitment', a.title, a.description, a.owner_user_id, a.owner_name, a.due_date,
  CASE a.status WHEN 'done' THEN 'kept' WHEN 'cancelled' THEN 'withdrawn' ELSE 'open' END,
  CASE a.source_type WHEN 'feedback_gap' THEN 'feedback' ELSE a.source_type END,
  CASE WHEN a.source_type = 'manual' THEN NULL ELSE a.source_id END,
  CASE WHEN a.status = 'done' THEN '{"kind":"legacy"}'::jsonb END,
  CASE WHEN a.status IN ('done', 'cancelled') THEN coalesce(a.done_at, a.updated_at) END,
  a.created_by, a.created_by_name, a.created_at, a.updated_at, a.origin, a.origin_run_id,
  a.origin_user_id
FROM "action" a WHERE a.visibility = 'shared';--> statement-breakpoint

INSERT INTO "task" ("id", "relationship_id", "org_id", "title", "description", "owner_user_id",
  "owner_name", "due_date", "status", "source_type", "source_id", "done_at", "created_by",
  "created_by_name", "created_at", "updated_at", "origin", "origin_run_id", "origin_user_id")
SELECT a.id, a.relationship_id, a.owner_org_id, a.title, a.description, a.owner_user_id,
  a.owner_name, a.due_date, a.status, a.source_type, a.source_id, a.done_at, a.created_by,
  a.created_by_name, a.created_at, a.updated_at, a.origin, a.origin_run_id, a.origin_user_id
FROM "action" a WHERE a.visibility = 'internal';--> statement-breakpoint

-- Private Quellen: an der Zusage weiter privat, bei Aufgaben als deren Quelle (Hinweis, FS-01)
INSERT INTO "commitment_private_source" ("id", "commitment_id", "relationship_id", "org_id",
  "source_type", "source_id")
SELECT ps.id, ps.action_id, ps.relationship_id, ps.org_id, ps.source_type, ps.source_id
FROM "action_private_source" ps JOIN "action" a ON a.id = ps.action_id
WHERE a.visibility = 'shared';--> statement-breakpoint
UPDATE "task" t SET "source_type" = 'hint', "source_id" = ps.source_id
FROM "action_private_source" ps
WHERE ps.action_id = t.id AND ps.source_type = 'hint' AND t.source_type = 'manual';--> statement-breakpoint

INSERT INTO "reminder_sent" ("id", "object_type", "object_id", "relationship_id", "org_id", "kind",
  "due_date", "sent_at")
SELECT n.id, CASE WHEN a.visibility = 'shared' THEN 'commitment' ELSE 'task' END, n.action_id,
  n.relationship_id, n.org_id, n.kind, n.due_date, n.sent_at
FROM "action_notification" n JOIN "action" a ON a.id = n.action_id;--> statement-breakpoint

-- Kommentare und Fokus-Themen zeigen auf das neue Objekt; Kommentare an gelöschten Maßnahmen
-- gelten als Aufgabe (ihr Objekt gibt es nicht mehr, sie bleiben nur lesbar)
UPDATE "comment" c SET "object_type" =
  CASE WHEN a.visibility = 'shared' THEN 'commitment' ELSE 'task' END
FROM "action" a WHERE c.object_type = 'action' AND c.object_id = a.id;--> statement-breakpoint
UPDATE "comment" SET "object_type" = 'task' WHERE "object_type" = 'action';--> statement-breakpoint
UPDATE "focus_item" f SET "object_type" =
  CASE WHEN a.visibility = 'shared' THEN 'commitment' ELSE 'task' END
FROM "action" a WHERE f.object_type = 'action' AND f.object_id = a.id;--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_object_type" CHECK ("comment"."object_type" in ('initiative', 'commitment', 'task', 'meeting', 'topic', 'rule_set'));--> statement-breakpoint

-- QBR-04 auf Zusagen und Aufgaben: Die Erinnerungen finden die Organisationen mit fälligen offenen
-- Zusagen oder Aufgaben über app_zusagen_due_orgs, wie bisher app_action_due_orgs (0063): Die enge
-- Rolle sieht nur Beziehung, Status und Frist und liefert nur Organisations-IDs.
GRANT SELECT ("relationship_id", "status", "due_on") ON "commitment" TO reziproq_action_jobs;--> statement-breakpoint
CREATE POLICY commitment_due_orgs ON "commitment" FOR SELECT TO reziproq_action_jobs USING (true);--> statement-breakpoint
GRANT SELECT ("relationship_id", "status", "due_date") ON "task" TO reziproq_action_jobs;--> statement-breakpoint
CREATE POLICY task_due_orgs ON "task" FOR SELECT TO reziproq_action_jobs USING (true);--> statement-breakpoint
CREATE FUNCTION app_zusagen_due_orgs(p_from date, p_to date)
  RETURNS TABLE (org_id uuid, customer_org_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
  WITH due AS (
    SELECT DISTINCT r.buyer_org_id, r.supplier_org_id
    FROM commitment c JOIN relationship r ON r.id = c.relationship_id
    WHERE c.status = 'open' AND r.status = 'active' AND c.due_on BETWEEN p_from AND p_to
    UNION
    SELECT DISTINCT r.buyer_org_id, r.supplier_org_id
    FROM task t JOIN relationship r ON r.id = t.relationship_id
    WHERE t.status IN ('open', 'in_progress') AND r.status = 'active'
      AND t.due_date BETWEEN p_from AND p_to
  )
  SELECT buyer_org_id, NULL::uuid FROM due
  UNION
  SELECT supplier_org_id, buyer_org_id FROM due
  ORDER BY 1, 2
$$;--> statement-breakpoint
ALTER FUNCTION app_zusagen_due_orgs(date, date) OWNER TO reziproq_action_jobs;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_zusagen_due_orgs(date, date) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_zusagen_due_orgs(date, date) TO reziproq_api;
