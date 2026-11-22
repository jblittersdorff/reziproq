CREATE TABLE "lever" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"dimensions" text[] DEFAULT '{}'::text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"custom" boolean DEFAULT false NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lever_name" CHECK (length(trim("lever"."name")) > 0),
	CONSTRAINT "lever_custom_reason" CHECK (not "lever"."custom" or length(trim(coalesce("lever"."reason", ''))) > 0)
);
--> statement-breakpoint
CREATE TABLE "material_group_lever_choice" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"internal_item_id" uuid NOT NULL,
	"external_item_id" uuid NOT NULL,
	"lever_id" uuid NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'chosen' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_group_lever_choice_status" CHECK ("material_group_lever_choice"."status" in ('proposed', 'chosen', 'dismissed')),
	CONSTRAINT "material_group_lever_choice_reason" CHECK ("material_group_lever_choice"."status" <> 'chosen' or length(trim("material_group_lever_choice"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "material_group_swot_item" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"strategy_id" uuid NOT NULL,
	"type" text NOT NULL,
	"code" text NOT NULL,
	"text" text NOT NULL,
	"origin_step" integer,
	"origin_view" text,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "material_group_swot_item_type" CHECK ("material_group_swot_item"."type" in ('strength', 'weakness', 'opportunity', 'threat')),
	CONSTRAINT "material_group_swot_item_status" CHECK ("material_group_swot_item"."status" in ('draft', 'confirmed')),
	CONSTRAINT "material_group_swot_item_text" CHECK (length(trim("material_group_swot_item"."text")) > 0),
	CONSTRAINT "material_group_swot_item_code" CHECK ("material_group_swot_item"."code" ~ '^[SWOT][0-9]+$')
);
--> statement-breakpoint
ALTER TABLE "lever" ADD CONSTRAINT "lever_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_lever_choice" ADD CONSTRAINT "material_group_lever_choice_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_lever_choice" ADD CONSTRAINT "material_group_lever_choice_strategy_id_material_group_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."material_group_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_lever_choice" ADD CONSTRAINT "material_group_lever_choice_internal_item_id_material_group_swot_item_id_fk" FOREIGN KEY ("internal_item_id") REFERENCES "public"."material_group_swot_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_lever_choice" ADD CONSTRAINT "material_group_lever_choice_external_item_id_material_group_swot_item_id_fk" FOREIGN KEY ("external_item_id") REFERENCES "public"."material_group_swot_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_lever_choice" ADD CONSTRAINT "material_group_lever_choice_lever_id_lever_id_fk" FOREIGN KEY ("lever_id") REFERENCES "public"."lever"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_swot_item" ADD CONSTRAINT "material_group_swot_item_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_swot_item" ADD CONSTRAINT "material_group_swot_item_strategy_id_material_group_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."material_group_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lever_name_once" ON "lever" USING btree ("org_id",lower("name"));--> statement-breakpoint
CREATE INDEX "material_group_lever_choice_strategy" ON "material_group_lever_choice" USING btree ("strategy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "material_group_swot_item_code_once" ON "material_group_swot_item" USING btree ("strategy_id","code");--> statement-breakpoint
SELECT app_apply_layer('material_group_swot_item', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('lever', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('material_group_lever_choice', 'org_private');--> statement-breakpoint
CREATE TRIGGER material_group_swot_item_owner BEFORE INSERT OR UPDATE ON material_group_swot_item
  FOR EACH ROW EXECUTE FUNCTION app_strategy_child();--> statement-breakpoint
-- WG-10: Eine Paarung verbindet genau einen internen (Stärke, Schwäche) mit genau einem externen
-- Eintrag (Chance, Risiko) derselben Strategie, mit einem Hebel der eigenen Organisation.
CREATE FUNCTION app_lever_choice_check() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  internal_type text;
  external_type text;
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
  SELECT org_id INTO owner FROM lever WHERE id = NEW.lever_id;
  IF owner IS NULL OR owner <> NEW.org_id THEN
    RAISE EXCEPTION 'foreign_entry: Nur eigene Hebel';
  END IF;
  SELECT type INTO internal_type FROM material_group_swot_item
    WHERE id = NEW.internal_item_id AND strategy_id = NEW.strategy_id;
  SELECT type INTO external_type FROM material_group_swot_item
    WHERE id = NEW.external_item_id AND strategy_id = NEW.strategy_id;
  IF internal_type IS NULL OR internal_type NOT IN ('strength', 'weakness')
    OR external_type IS NULL OR external_type NOT IN ('opportunity', 'threat') THEN
    RAISE EXCEPTION 'invalid_pairing: Eine Paarung verbindet einen internen mit einem externen Eintrag';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER material_group_lever_choice_check BEFORE INSERT OR UPDATE ON material_group_lever_choice
  FOR EACH ROW EXECUTE FUNCTION app_lever_choice_check();
