CREATE TABLE "commitment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"owner_org_id" uuid NOT NULL,
	"visibility" text DEFAULT 'shared' NOT NULL,
	"jbp_id" uuid NOT NULL,
	"initiative_id" uuid,
	"side" text NOT NULL,
	"title" text NOT NULL,
	"owner_user_id" text,
	"owner_name" text NOT NULL,
	"due_on" date NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_by" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commitment_side" CHECK ("commitment"."side" in ('buyer', 'supplier')),
	CONSTRAINT "commitment_status" CHECK ("commitment"."status" in ('open', 'kept', 'missed')),
	CONSTRAINT "commitment_title" CHECK (length(trim("commitment"."title")) between 1 and 200),
	CONSTRAINT "commitment_owner" CHECK (length(trim("commitment"."owner_name")) between 1 and 200)
);
--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_owner_org_id_organization_id_fk" FOREIGN KEY ("owner_org_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_jbp_id_jbp_id_fk" FOREIGN KEY ("jbp_id") REFERENCES "public"."jbp"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commitment" ADD CONSTRAINT "commitment_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commitment_jbp" ON "commitment" USING btree ("jbp_id","due_on");--> statement-breakpoint
CREATE INDEX "commitment_owner_user" ON "commitment" USING btree ("owner_user_id");--> statement-breakpoint
SELECT app_apply_layer('commitment', 'shared');--> statement-breakpoint

-- JBP-05: Jede Seite wählt die verantwortliche Person ihrer Seite auch an Initiativen (JBP-03),
-- deren Zeile oft der anderen Seite gehört. Die Funktion setzt nur Person und Namen der eigenen
-- Seite; die Seite ergibt sich aus der Session, nicht aus einem Parameter.
GRANT UPDATE ("owner_buyer_user_id", "owner_supplier_user_id") ON "initiative" TO reziproq_initiativen;--> statement-breakpoint
CREATE FUNCTION app_initiative_owner(p_id uuid, p_user_id text, p_name text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
  AS $$
DECLARE
  v_relationship uuid;
  v_status text;
BEGIN
  SELECT i.relationship_id, j.status INTO v_relationship, v_status
  FROM initiative i JOIN jbp j ON j.id = i.jbp_id
  WHERE i.id = p_id AND i.visibility = 'shared';
  IF v_relationship IS NULL OR NOT app_is_relationship_party(v_relationship) THEN
    RAISE EXCEPTION 'initiative_not_found';
  END IF;
  IF v_status = 'approved' THEN
    RAISE EXCEPTION 'plan_approved';
  END IF;
  IF app_is_relationship_buyer(v_relationship) THEN
    UPDATE initiative SET owner_buyer_user_id = p_user_id, owner_buyer_name = p_name,
      updated_at = now() WHERE id = p_id;
  ELSE
    UPDATE initiative SET owner_supplier_user_id = p_user_id, owner_supplier_name = p_name,
      updated_at = now() WHERE id = p_id;
  END IF;
END
$$;--> statement-breakpoint
ALTER FUNCTION app_initiative_owner(uuid, text, text) OWNER TO reziproq_initiativen;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION app_initiative_owner(uuid, text, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_initiative_owner(uuid, text, text) TO reziproq_app;
