CREATE TABLE "material_group_member" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"material_group_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"business_unit_id" uuid,
	"region" text,
	"task" text,
	CONSTRAINT "material_group_member_once" UNIQUE("material_group_id","user_id","role"),
	CONSTRAINT "material_group_member_role" CHECK ("material_group_member"."role" in ('lead', 'commodity_manager', 'buyer', 'function'))
);
--> statement-breakpoint
CREATE TABLE "material_group_product_group" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"material_group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "org_setting" DROP CONSTRAINT "org_setting_key";--> statement-breakpoint
ALTER TABLE "material_group" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "material_group" ADD COLUMN "lead_user_id" text;--> statement-breakpoint
ALTER TABLE "material_group" ADD COLUMN "commodity_manager_user_id" text;--> statement-breakpoint
ALTER TABLE "relationship_material_group" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "relationship_spend" ADD COLUMN "product_group_id" uuid;--> statement-breakpoint
ALTER TABLE "material_group_member" ADD CONSTRAINT "material_group_member_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_member" ADD CONSTRAINT "material_group_member_material_group_id_material_group_id_fk" FOREIGN KEY ("material_group_id") REFERENCES "public"."material_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_member" ADD CONSTRAINT "material_group_member_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_member" ADD CONSTRAINT "material_group_member_business_unit_id_business_unit_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_product_group" ADD CONSTRAINT "material_group_product_group_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group_product_group" ADD CONSTRAINT "material_group_product_group_material_group_id_material_group_id_fk" FOREIGN KEY ("material_group_id") REFERENCES "public"."material_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "material_group_member_group" ON "material_group_member" USING btree ("material_group_id");--> statement-breakpoint
CREATE INDEX "material_group_product_group_group" ON "material_group_product_group" USING btree ("material_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "material_group_product_group_name" ON "material_group_product_group" USING btree ("material_group_id",lower("name"));--> statement-breakpoint
ALTER TABLE "material_group" ADD CONSTRAINT "material_group_lead_user_id_app_user_id_fk" FOREIGN KEY ("lead_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group" ADD CONSTRAINT "material_group_commodity_manager_user_id_app_user_id_fk" FOREIGN KEY ("commodity_manager_user_id") REFERENCES "public"."app_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_spend" ADD CONSTRAINT "relationship_spend_product_group_id_material_group_product_group_id_fk" FOREIGN KEY ("product_group_id") REFERENCES "public"."material_group_product_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_setting" ADD CONSTRAINT "org_setting_key" CHECK ("org_setting"."key" in ('action_reminder_days', 'fiscal_year_start_month', 'hint_max_focus_per_sro',
        'category_label_singular', 'category_label_plural'));--> statement-breakpoint
ALTER TABLE "relationship_material_group" ADD CONSTRAINT "relationship_material_group_source" CHECK ("relationship_material_group"."source" in ('spend', 'manual'));--> statement-breakpoint
-- WG-01: Produktgruppen und Team je Warengruppe gehören der eigenen Organisation.
SELECT app_apply_layer('material_group_product_group', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('material_group_member', 'org_private');--> statement-breakpoint

-- Nur eigene Warengruppen, und im Team nur Personen der eigenen Organisation. Fremde Einträge
-- sieht die Session über RLS nicht; der Fremdschlüssel allein prüft das nicht.
CREATE FUNCTION app_material_group_child() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  group_org uuid;
  user_org uuid;
BEGIN
  -- Fremde Zeilen lehnt danach Row-Level Security ab; hier nur die eigenen prüfen (wie 0017).
  IF NEW.org_id IS DISTINCT FROM app_current_organization_id() THEN
    RETURN NEW;
  END IF;
  SELECT org_id INTO group_org FROM material_group WHERE id = NEW.material_group_id;
  IF group_org IS NULL OR group_org <> NEW.org_id THEN
    RAISE EXCEPTION 'foreign_entry: Nur eigene Warengruppen';
  END IF;
  IF TG_TABLE_NAME = 'material_group_member' THEN
    SELECT organization_id INTO user_org FROM app_user WHERE id = NEW.user_id;
    IF user_org IS NULL OR user_org <> NEW.org_id THEN
      RAISE EXCEPTION 'foreign_user: Nur Personen der eigenen Organisation';
    END IF;
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER material_group_product_group_owner BEFORE INSERT OR UPDATE ON material_group_product_group
  FOR EACH ROW EXECUTE FUNCTION app_material_group_child();--> statement-breakpoint
CREATE TRIGGER material_group_member_owner BEFORE INSERT OR UPDATE ON material_group_member
  FOR EACH ROW EXECUTE FUNCTION app_material_group_child();--> statement-breakpoint

-- Die Produktgruppe am Spend gehört zur Warengruppe derselben Zeile.
CREATE FUNCTION app_spend_product_group() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF NEW.product_group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM material_group_product_group p
    WHERE p.id = NEW.product_group_id AND p.material_group_id = NEW.material_group_id
  ) THEN
    RAISE EXCEPTION 'product_group_mismatch: Die Produktgruppe gehört nicht zu dieser Warengruppe';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER relationship_spend_product_group BEFORE INSERT OR UPDATE OF product_group_id, material_group_id
  ON relationship_spend FOR EACH ROW EXECUTE FUNCTION app_spend_product_group();--> statement-breakpoint

-- Spend mit Warengruppe ordnet den Lieferanten dieser Warengruppe zu (Quelle „spend“). Eine
-- vorhandene manuelle Zuordnung bleibt; die erste Zuordnung wird Haupt-Warengruppe. Deaktivierte
-- Warengruppen werden nicht neu zugeordnet.
CREATE FUNCTION app_spend_material_group() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  IF NEW.material_group_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM material_group g WHERE g.id = NEW.material_group_id AND g.active) THEN
    RETURN NEW;
  END IF;
  INSERT INTO relationship_material_group (relationship_id, material_group_id, is_primary, source)
  VALUES (
    NEW.relationship_id,
    NEW.material_group_id,
    NOT EXISTS (
      SELECT 1 FROM relationship_material_group r
      WHERE r.relationship_id = NEW.relationship_id AND r.is_primary
    ),
    'spend'
  )
  ON CONFLICT ON CONSTRAINT relationship_material_group_once DO NOTHING;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER relationship_spend_material_group AFTER INSERT OR UPDATE OF material_group_id
  ON relationship_spend FOR EACH ROW EXECUTE FUNCTION app_spend_material_group();--> statement-breakpoint

-- Bestehender Spend: Zuordnungen nachtragen.
INSERT INTO relationship_material_group (relationship_id, material_group_id, is_primary, source)
SELECT DISTINCT ON (s.relationship_id, s.material_group_id)
  s.relationship_id, s.material_group_id, false, 'spend'
FROM relationship_spend s
JOIN material_group g ON g.id = s.material_group_id AND g.active
WHERE s.material_group_id IS NOT NULL
ON CONFLICT ON CONSTRAINT relationship_material_group_once DO NOTHING;--> statement-breakpoint
UPDATE relationship_material_group r SET is_primary = true
WHERE r.id IN (
  SELECT DISTINCT ON (x.relationship_id) x.id FROM relationship_material_group x
  WHERE NOT EXISTS (
    SELECT 1 FROM relationship_material_group p WHERE p.relationship_id = x.relationship_id AND p.is_primary
  )
  ORDER BY x.relationship_id, x.id
);
