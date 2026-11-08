CREATE TABLE "supplier_contact" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"function" text,
	"position" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_contact" ADD CONSTRAINT "supplier_contact_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_contact_email" ON "supplier_contact" USING btree ("relationship_id",lower("email"));--> statement-breakpoint
CREATE INDEX "supplier_contact_relationship" ON "supplier_contact" USING btree ("relationship_id");
--> statement-breakpoint
SELECT app_apply_layer('supplier_contact', 'buyer_private');