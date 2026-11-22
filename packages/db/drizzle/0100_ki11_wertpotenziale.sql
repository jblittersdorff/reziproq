CREATE TABLE "value_data_gap" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"run_id" uuid,
	"data_key" text NOT NULL,
	"description" text NOT NULL,
	"templates_blocked" jsonb NOT NULL,
	"signal_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "value_data_gap_status" CHECK ("value_data_gap"."status" in ('open', 'requested', 'closed'))
);
--> statement-breakpoint
CREATE TABLE "value_market_signal" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"run_id" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"direction" text NOT NULL,
	"sources" jsonb NOT NULL,
	"outcome" text NOT NULL,
	"outcome_reason" text NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "value_market_signal_kind" CHECK ("value_market_signal"."kind" in ('raw_material', 'market_capacity', 'supplier_public', 'tariff_regulation', 'technology')),
	CONSTRAINT "value_market_signal_outcome" CHECK ("value_market_signal"."outcome" in ('opportunity', 'topic', 'data_gap', 'no_effect')),
	CONSTRAINT "value_market_signal_direction" CHECK ("value_market_signal"."direction" in ('relief', 'burden', 'neutral')),
	CONSTRAINT "value_market_signal_sources" CHECK (jsonb_array_length("value_market_signal"."sources") > 0)
);
--> statement-breakpoint
CREATE TABLE "value_opportunity" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"relationship_id" uuid NOT NULL,
	"run_id" uuid,
	"template_key" text NOT NULL,
	"template_version" integer NOT NULL,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"impact_type" text NOT NULL,
	"buyer_low_cents" bigint NOT NULL,
	"buyer_high_cents" bigint NOT NULL,
	"supplier_low_cents" bigint,
	"supplier_high_cents" bigint,
	"supplier_effect" text,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"confidence" text NOT NULL,
	"confidence_reason" text NOT NULL,
	"inputs" jsonb NOT NULL,
	"signal_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"dismiss_reason" text,
	"adopted_topic_id" uuid,
	"initiative_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	CONSTRAINT "value_opportunity_impact" CHECK ("value_opportunity"."impact_type" in ('ebit', 'cash', 'cost_avoidance')),
	CONSTRAINT "value_opportunity_confidence" CHECK ("value_opportunity"."confidence" in ('high', 'medium', 'low')),
	CONSTRAINT "value_opportunity_status" CHECK ("value_opportunity"."status" in ('new', 'adopted', 'dismissed', 'superseded', 'realized')),
	CONSTRAINT "value_opportunity_range" CHECK ("value_opportunity"."buyer_low_cents" <= "value_opportunity"."buyer_high_cents"
        and ("value_opportunity"."supplier_low_cents" is null) = ("value_opportunity"."supplier_high_cents" is null)
        and ("value_opportunity"."supplier_low_cents" is null or "value_opportunity"."supplier_low_cents" <= "value_opportunity"."supplier_high_cents")),
	CONSTRAINT "value_opportunity_dismiss" CHECK ("value_opportunity"."status" <> 'dismissed' or length(trim(coalesce("value_opportunity"."dismiss_reason", ''))) > 0)
);
--> statement-breakpoint
ALTER TABLE "value_data_gap" ADD CONSTRAINT "value_data_gap_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_data_gap" ADD CONSTRAINT "value_data_gap_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_market_signal" ADD CONSTRAINT "value_market_signal_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_market_signal" ADD CONSTRAINT "value_market_signal_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_opportunity" ADD CONSTRAINT "value_opportunity_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_opportunity" ADD CONSTRAINT "value_opportunity_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "value_data_gap_relationship" ON "value_data_gap" USING btree ("relationship_id","status");--> statement-breakpoint
CREATE INDEX "value_market_signal_relationship" ON "value_market_signal" USING btree ("relationship_id","observed_at");--> statement-breakpoint
CREATE INDEX "value_opportunity_relationship" ON "value_opportunity" USING btree ("relationship_id","status");--> statement-breakpoint
SELECT app_apply_layer('value_opportunity', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('value_market_signal', 'org_private');--> statement-breakpoint
SELECT app_apply_layer('value_data_gap', 'org_private');
