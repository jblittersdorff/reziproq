CREATE TABLE "business_unit" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material_group" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"parent_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationship_business_unit" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"business_unit_id" uuid NOT NULL,
	CONSTRAINT "relationship_business_unit_once" UNIQUE("relationship_id","business_unit_id")
);
--> statement-breakpoint
CREATE TABLE "relationship_material_group" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"material_group_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	CONSTRAINT "relationship_material_group_once" UNIQUE("relationship_id","material_group_id")
);
--> statement-breakpoint
ALTER TABLE "business_unit" ADD CONSTRAINT "business_unit_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group" ADD CONSTRAINT "material_group_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "material_group" ADD CONSTRAINT "material_group_parent_id_material_group_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."material_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_business_unit" ADD CONSTRAINT "relationship_business_unit_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_business_unit" ADD CONSTRAINT "relationship_business_unit_business_unit_id_business_unit_id_fk" FOREIGN KEY ("business_unit_id") REFERENCES "public"."business_unit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_material_group" ADD CONSTRAINT "relationship_material_group_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_material_group" ADD CONSTRAINT "relationship_material_group_material_group_id_material_group_id_fk" FOREIGN KEY ("material_group_id") REFERENCES "public"."material_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_unit_code" ON "business_unit" USING btree ("org_id",lower("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "material_group_code" ON "material_group" USING btree ("org_id",lower("code"));--> statement-breakpoint
CREATE INDEX "material_group_parent" ON "material_group" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "relationship_business_unit_unit" ON "relationship_business_unit" USING btree ("business_unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "relationship_material_group_primary" ON "relationship_material_group" USING btree ("relationship_id") WHERE "relationship_material_group"."is_primary";--> statement-breakpoint
CREATE INDEX "relationship_material_group_group" ON "relationship_material_group" USING btree ("material_group_id");--> statement-breakpoint

-- PLT-04: Datenebenen. BUs und Warengruppen gehören der Organisation, Zuordnungen dem Käufer.
SELECT app_apply_layer('business_unit', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('material_group', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('relationship_business_unit', 'buyer_private');--> statement-breakpoint
SELECT app_apply_layer('relationship_material_group', 'buyer_private');--> statement-breakpoint

-- Höchstens zwei Ebenen: Eine Oberebene hat selbst keine Oberebene, und eine Gruppe mit
-- Untergruppen bekommt keine Oberebene. Die Oberebene gehört derselben Organisation.
CREATE FUNCTION app_material_group_levels() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  parent material_group;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO parent FROM material_group WHERE id = NEW.parent_id;
  IF parent.id IS NULL OR parent.org_id <> NEW.org_id THEN
    RAISE EXCEPTION 'foreign_entry: Die Oberebene gehört nicht zur eigenen Organisation';
  END IF;
  IF parent.id = NEW.id OR parent.parent_id IS NOT NULL
    OR EXISTS (SELECT 1 FROM material_group c WHERE c.parent_id = NEW.id) THEN
    RAISE EXCEPTION 'too_deep: Warengruppen haben höchstens zwei Ebenen';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER material_group_levels BEFORE INSERT OR UPDATE OF parent_id ON material_group
  FOR EACH ROW EXECUTE FUNCTION app_material_group_levels();--> statement-breakpoint

-- Zuordnungen: nur Einträge der Organisation, die in der Beziehung Käufer ist, und neu nur
-- aktive. Bestehende Zuordnungen auf deaktivierte Einträge bleiben erhalten.
CREATE FUNCTION app_assignment_entry() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  entry_org uuid;
  entry_active boolean;
  buyer uuid;
BEGIN
  -- Fremde Beziehungen lehnt danach Row-Level Security ab; hier nur die eigenen prüfen.
  IF NOT app_is_relationship_buyer(NEW.relationship_id) THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'relationship_business_unit' THEN
    IF TG_OP = 'UPDATE' AND NEW.business_unit_id = OLD.business_unit_id THEN
      RETURN NEW;
    END IF;
    SELECT org_id, active INTO entry_org, entry_active FROM business_unit WHERE id = NEW.business_unit_id;
  ELSE
    IF TG_OP = 'UPDATE' AND NEW.material_group_id = OLD.material_group_id THEN
      RETURN NEW;
    END IF;
    SELECT org_id, active INTO entry_org, entry_active FROM material_group WHERE id = NEW.material_group_id;
  END IF;
  SELECT buyer_org_id INTO buyer FROM relationship WHERE id = NEW.relationship_id;
  IF entry_org IS NULL OR buyer IS NULL OR entry_org <> buyer THEN
    RAISE EXCEPTION 'foreign_entry: Nur eigene Business Units und Warengruppen sind zuordenbar';
  END IF;
  IF NOT entry_active THEN
    RAISE EXCEPTION 'inactive: Deaktivierte Einträge sind für neue Zuordnungen nicht wählbar';
  END IF;
  RETURN NEW;
END
$$;--> statement-breakpoint
CREATE TRIGGER relationship_business_unit_entry BEFORE INSERT OR UPDATE ON relationship_business_unit
  FOR EACH ROW EXECUTE FUNCTION app_assignment_entry();--> statement-breakpoint
CREATE TRIGGER relationship_material_group_entry BEFORE INSERT OR UPDATE ON relationship_material_group
  FOR EACH ROW EXECUTE FUNCTION app_assignment_entry();--> statement-breakpoint

-- Genau eine Haupt-Warengruppe je Beziehung, sobald sie Warengruppen hat. Geprüft am Ende der
-- Transaktion, damit sich die Haupt-Warengruppe in einem Schritt wechseln lässt.
CREATE FUNCTION app_primary_material_group() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
DECLARE
  rel uuid := coalesce(NEW.relationship_id, OLD.relationship_id);
  total int;
  primaries int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE is_primary) INTO total, primaries
  FROM relationship_material_group WHERE relationship_id = rel;
  IF total > 0 AND primaries <> 1 THEN
    RAISE EXCEPTION 'primary_required: Genau eine Haupt-Warengruppe je Lieferant';
  END IF;
  RETURN NULL;
END
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER relationship_material_group_primary_check
  AFTER INSERT OR UPDATE OR DELETE ON relationship_material_group
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION app_primary_material_group();
