CREATE TABLE "supplier_executive" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"since" smallint,
	"position" integer NOT NULL,
	CONSTRAINT "supplier_executive_name" CHECK (length(trim("supplier_executive"."name")) between 1 and 120),
	CONSTRAINT "supplier_executive_role" CHECK (length(trim("supplier_executive"."role")) between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "supplier_financial" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"year" smallint NOT NULL,
	"metric" text NOT NULL,
	"value" bigint NOT NULL,
	"unit" text NOT NULL,
	"currency" text,
	"source" text NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_financial_je_jahr" UNIQUE("relationship_id","year","metric"),
	CONSTRAINT "supplier_financial_metric" CHECK ("supplier_financial"."metric" in ('revenue', 'ebit_margin', 'net_debt', 'equity_ratio', 'cash')),
	CONSTRAINT "supplier_financial_unit" CHECK (case when "supplier_financial"."metric" in ('ebit_margin', 'equity_ratio')
        then "supplier_financial"."unit" = 'basis_points' and "supplier_financial"."currency" is null
        else "supplier_financial"."unit" = 'cents' and "supplier_financial"."currency" ~ '^[A-Z]{3}$' end),
	CONSTRAINT "supplier_financial_source" CHECK (length(trim("supplier_financial"."source")) between 1 and 500),
	CONSTRAINT "supplier_financial_year" CHECK ("supplier_financial"."year" between 1990 and 2100)
);
--> statement-breakpoint
CREATE TABLE "supplier_profile" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"headquarters" text,
	"founded_year" smallint,
	"employees" integer,
	"business_segments" text,
	"implications" text,
	"updated_by" text NOT NULL,
	"updated_by_name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_profile_werte" CHECK (("supplier_profile"."founded_year" is null or "supplier_profile"."founded_year" between 1600 and 2100) and ("supplier_profile"."employees" is null or "supplier_profile"."employees" >= 0))
);
--> statement-breakpoint
ALTER TABLE "supplier_executive" ADD CONSTRAINT "supplier_executive_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_financial" ADD CONSTRAINT "supplier_financial_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_profile" ADD CONSTRAINT "supplier_profile_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_executive_relationship" ON "supplier_executive" USING btree ("relationship_id");--> statement-breakpoint
CREATE INDEX "supplier_profile_relationship" ON "supplier_profile" USING btree ("relationship_id");--> statement-breakpoint
SELECT app_apply_layer('supplier_profile', 'buyer_private');--> statement-breakpoint
SELECT app_apply_layer('supplier_executive', 'buyer_private');--> statement-breakpoint
SELECT app_apply_layer('supplier_financial', 'buyer_private');
