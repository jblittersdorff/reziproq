CREATE TABLE "material_group_goal" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"kpi_id" uuid NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"actual" numeric(14, 4),
	"target_next_year" numeric(14, 4),
	"target_final" numeric(14, 4),
	"target_quarter" integer,
	"target_year" integer,
	"deferred" boolean DEFAULT false NOT NULL,
	"deferred_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_group_goal_deferred" CHECK (not "material_group_goal"."deferred" or length(trim(coalesce("material_group_goal"."deferred_reason", ''))) > 0),
	CONSTRAINT "material_group_goal_text" CHECK ("material_group_goal"."deferred" or length(trim("material_group_goal"."text")) > 0),
	CONSTRAINT "material_group_goal_quarter" CHECK ("material_group_goal"."target_quarter" is null or "material_group_goal"."target_quarter" between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE "material_group_kpi" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"dimension" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"unit" text,
	"source" text,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_group_milestone" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"title" text NOT NULL,
	"due_on" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_group_note" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"view" text DEFAULT '' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"not_applicable" boolean DEFAULT false NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_group_note_step" CHECK ("material_group_note"."step" between 1 and 10),
	CONSTRAINT "material_group_note_reason" CHECK (not "material_group_note"."not_applicable" or length(trim("material_group_note"."text")) > 0)
);
--> statement-breakpoint
CREATE TABLE "material_group_question" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"step" integer NOT NULL,
	"view" text,
	"text" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "material_group_question_step" CHECK ("material_group_question"."step" between 1 and 10)
);
--> statement-breakpoint
CREATE TABLE "material_group_strategy" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"material_group_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"last_submitted_at" timestamp with time zone,
	"changed_since_submission" boolean DEFAULT false NOT NULL,
	"approved_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_group_strategy_once" UNIQUE("material_group_id","year","version"),
	CONSTRAINT "material_group_strategy_status" CHECK ("material_group_strategy"."status" in ('draft', 'resubmit', 'approved')),
	CONSTRAINT "material_group_strategy_year" CHECK ("material_group_strategy"."year" between 2000 and 2100)
);
--> statement-breakpoint
ALTER TABLE "material_group_goal" ADD CONSTRAINT "material_group_goal_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_goal" ADD CONSTRAINT "material_group_goal_strategy_id_material_group_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."material_group_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_goal" ADD CONSTRAINT "material_group_goal_kpi_id_material_group_kpi_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "public"."material_group_kpi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_kpi" ADD CONSTRAINT "material_group_kpi_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_milestone" ADD CONSTRAINT "material_group_milestone_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_milestone" ADD CONSTRAINT "material_group_milestone_strategy_id_material_group_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."material_group_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_note" ADD CONSTRAINT "material_group_note_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_note" ADD CONSTRAINT "material_group_note_strategy_id_material_group_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."material_group_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_question" ADD CONSTRAINT "material_group_question_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_strategy" ADD CONSTRAINT "material_group_strategy_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_strategy" ADD CONSTRAINT "material_group_strategy_material_group_id_material_group_id_fk" FOREIGN KEY ("material_group_id") REFERENCES "public"."material_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_strategy" ADD CONSTRAINT "material_group_strategy_created_by_app_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_group_goal_strategy" ON "material_group_goal" USING btree ("strategy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "material_group_kpi_name" ON "material_group_kpi" USING btree ("org_id","dimension",lower("name"));--> statement-breakpoint
CREATE INDEX "material_group_milestone_strategy" ON "material_group_milestone" USING btree ("strategy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "material_group_note_once" ON "material_group_note" USING btree ("strategy_id","step","view");--> statement-breakpoint
CREATE INDEX "material_group_question_org" ON "material_group_question" USING btree ("org_id","step");--> statement-breakpoint
CREATE INDEX "material_group_strategy_org" ON "material_group_strategy" USING btree ("org_id","year");--> statement-breakpoint
-- WG-04, WG-06: alles nur für die eigene Organisation.
SELECT app_apply_layer('material_group_strategy', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('material_group_question', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('material_group_note', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('material_group_milestone', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('material_group_kpi', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('material_group_goal', 'org_private');--> statement-breakpoint

-- Die Strategie hängt an einer eigenen Warengruppe (Prüfung wie bei Team und Produktgruppen).
CREATE TRIGGER material_group_strategy_owner BEFORE INSERT OR UPDATE ON material_group_strategy
  FOR EACH ROW EXECUTE FUNCTION app_material_group_child();--> statement-breakpoint

-- Notizen, Meilensteine und Ziele gehören zu einer eigenen Strategie, Ziele an eigene Kennzahlen.
CREATE FUNCTION app_strategy_child() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  owner uuid;
BEGIN
  -- Fremde Zeilen lehnt danach Row-Level Security ab; hier nur die eigenen prüfen.
  IF NEW.org_id IS DISTINCT FROM app_current_organization_id() THEN
    RETURN NEW;
  END IF;
  SELECT org_id INTO owner FROM material_group_strategy WHERE id = NEW.strategy_id;
  IF owner IS NULL OR owner <> NEW.org_id THEN
    RAISE EXCEPTION 'foreign_entry: Nur eigene Strategien';
  END IF;
  IF TG_TABLE_NAME = 'material_group_goal' THEN
    SELECT org_id INTO owner FROM material_group_kpi WHERE id = NEW.kpi_id;
    IF owner IS NULL OR owner <> NEW.org_id THEN
      RAISE EXCEPTION 'foreign_entry: Nur eigene Kennzahlen';
    END IF;
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER material_group_note_owner BEFORE INSERT OR UPDATE ON material_group_note
  FOR EACH ROW EXECUTE FUNCTION app_strategy_child();--> statement-breakpoint
CREATE TRIGGER material_group_milestone_owner BEFORE INSERT OR UPDATE ON material_group_milestone
  FOR EACH ROW EXECUTE FUNCTION app_strategy_child();--> statement-breakpoint
CREATE TRIGGER material_group_goal_owner BEFORE INSERT OR UPDATE ON material_group_goal
  FOR EACH ROW EXECUTE FUNCTION app_strategy_child();
