CREATE TABLE "relationship" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"buyer_org_id" uuid NOT NULL,
	"supplier_org_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "relationship_paar" UNIQUE("buyer_org_id","supplier_org_id"),
	CONSTRAINT "relationship_status" CHECK ("relationship"."status" in ('draft', 'active', 'ended')),
	CONSTRAINT "relationship_nicht_mit_sich_selbst" CHECK ("relationship"."buyer_org_id" <> "relationship"."supplier_org_id")
);
--> statement-breakpoint
CREATE TABLE "relationship_side" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"display_name" text,
	"external_ref" text,
	"notes" text,
	"is_focus" boolean DEFAULT false NOT NULL,
	"focus_reason" text,
	CONSTRAINT "relationship_side_je_seite" UNIQUE("relationship_id","org_id")
);
--> statement-breakpoint
CREATE TABLE "relationship_spend" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	CONSTRAINT "relationship_spend_je_jahr" UNIQUE("relationship_id","year"),
	CONSTRAINT "relationship_spend_positiv" CHECK ("relationship_spend"."amount_cents" >= 0),
	CONSTRAINT "relationship_spend_waehrung_iso" CHECK ("relationship_spend"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "relationship_spend_quelle" CHECK ("relationship_spend"."source" in ('manual', 'import', 'seed'))
);
--> statement-breakpoint
ALTER TABLE "relationship" ADD CONSTRAINT "relationship_buyer_org_id_organization_id_fk" FOREIGN KEY ("buyer_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship" ADD CONSTRAINT "relationship_supplier_org_id_organization_id_fk" FOREIGN KEY ("supplier_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_side" ADD CONSTRAINT "relationship_side_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_side" ADD CONSTRAINT "relationship_side_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_spend" ADD CONSTRAINT "relationship_spend_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- PLT-03a: Die Beziehung zieht aus beziehung und beziehung_kaeufer in das neue Modell um.
-- Die Warengruppe (Freitext) entfällt; Warengruppen kommen mit PLT-06 als eigene Liste.

-- 1. Bestandsdaten ----------------------------------------------------------------------------

INSERT INTO "relationship" ("id", "buyer_org_id", "supplier_org_id", "status", "created_at", "ended_at")
  SELECT "id", "kaeufer_org_id", "lieferant_org_id",
    CASE WHEN "ended_at" IS NULL THEN 'active' ELSE 'ended' END,
    "created_at", "ended_at"
  FROM "beziehung";--> statement-breakpoint

INSERT INTO "relationship_spend" ("relationship_id", "year", "amount_cents", "currency", "source")
  SELECT "beziehung_id", "spend_jahr", "jahresspend_cent", "waehrung", 'import'
  FROM "beziehung_kaeufer";--> statement-breakpoint

-- 2. Prüffunktionen aus PLT-04 lesen jetzt relationship -------------------------------------
--
-- „Aktiv“ heißt status = 'active'. Im Entwurf und nach dem Ende sieht die andere Seite keine
-- freigegebenen Zeilen.

GRANT SELECT ON "relationship" TO reziproq_ebenen;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_is_relationship_buyer(p_relationship_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM relationship r
      WHERE r.id = p_relationship_id AND r.buyer_org_id = app_current_organization_id()
    )
  $$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_is_relationship_supplier(p_relationship_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM relationship r
      WHERE r.id = p_relationship_id
        AND r.supplier_org_id = app_current_organization_id()
        AND r.buyer_org_id = app_current_customer_id()
    )
  $$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_can_see_relationship(p_relationship_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM relationship r
      WHERE r.id = p_relationship_id
        AND r.status = 'active'
        AND (
          r.buyer_org_id = app_current_organization_id()
          OR (
            r.supplier_org_id = app_current_organization_id()
            AND r.buyer_org_id = app_current_customer_id()
          )
        )
    )
  $$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION app_relationship_customer_ok(p_relationship_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT NOT EXISTS (
      SELECT 1 FROM relationship r
      WHERE r.id = p_relationship_id
        AND r.supplier_org_id = app_current_organization_id()
        AND r.buyer_org_id IS DISTINCT FROM app_current_customer_id()
    )
  $$;--> statement-breakpoint

-- Stammdaten: Der Käufer sieht seine Lieferanten immer, der Lieferant seine Kunden erst, wenn die
-- Beziehung kein Entwurf mehr ist (PLT-03). Andere Käufer erfahren nichts von der Beziehung.
CREATE OR REPLACE FUNCTION app_is_related_organization(p_organization_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM relationship r
      WHERE (r.buyer_org_id = app_current_organization_id() AND r.supplier_org_id = p_organization_id)
         OR (
           r.supplier_org_id = app_current_organization_id()
           AND r.buyer_org_id = p_organization_id
           AND r.status <> 'draft'
         )
    )
  $$;--> statement-breakpoint

-- 3. Policies -----------------------------------------------------------------------------------

-- relationship: Anker aller Beziehungsdaten (Art shared, Policies von Hand). Der Käufer sieht alle
-- seine Beziehungen, der Lieferant nur aktive und nur im Kontext dieses Kunden. Schreiben kommt
-- mit PLT-03b.
ALTER TABLE "relationship" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "relationship" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT ON "relationship" TO reziproq_app;--> statement-breakpoint
CREATE POLICY "relationship_ebenen" ON "relationship"
  FOR SELECT TO reziproq_ebenen USING (true);--> statement-breakpoint
CREATE POLICY "relationship_lesen" ON "relationship"
  FOR SELECT TO reziproq_app
  USING (
    "buyer_org_id" = app_current_organization_id()
    OR (
      "supplier_org_id" = app_current_organization_id()
      AND "buyer_org_id" = app_current_customer_id()
      AND "status" = 'active'
    )
  );--> statement-breakpoint

SELECT app_apply_layer('relationship_side', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('relationship_spend', 'buyer_private');
