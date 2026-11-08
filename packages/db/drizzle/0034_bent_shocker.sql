CREATE TABLE "strategic_topic" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"title" text NOT NULL,
	"reason" text NOT NULL,
	"priority" integer NOT NULL,
	CONSTRAINT "strategic_topic_id_relationship" UNIQUE("id","relationship_id"),
	CONSTRAINT "strategic_topic_title" CHECK (length(trim("strategic_topic"."title")) between 1 and 200),
	CONSTRAINT "strategic_topic_reason" CHECK (length(trim("strategic_topic"."reason")) between 1 and 2000),
	CONSTRAINT "strategic_topic_priority" CHECK ("strategic_topic"."priority" > 0)
);
--> statement-breakpoint
CREATE TABLE "strategic_topic_objective" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"relationship_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"objective_id" uuid NOT NULL,
	CONSTRAINT "strategic_topic_objective_once" UNIQUE("topic_id","objective_id")
);
--> statement-breakpoint
ALTER TABLE "plan_objective" ADD CONSTRAINT "plan_objective_id_relationship" UNIQUE("id","relationship_id");--> statement-breakpoint
ALTER TABLE "strategic_topic" ADD CONSTRAINT "strategic_topic_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_topic" ADD CONSTRAINT "strategic_topic_plan_relationship_fk" FOREIGN KEY ("plan_id","relationship_id") REFERENCES "public"."supplier_plan"("id","relationship_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_topic_objective" ADD CONSTRAINT "strategic_topic_objective_relationship_id_relationship_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationship"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_topic_objective" ADD CONSTRAINT "strategic_topic_objective_topic_fk" FOREIGN KEY ("topic_id","relationship_id") REFERENCES "public"."strategic_topic"("id","relationship_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategic_topic_objective" ADD CONSTRAINT "strategic_topic_objective_objective_fk" FOREIGN KEY ("objective_id","relationship_id") REFERENCES "public"."plan_objective"("id","relationship_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
SELECT app_apply_layer('strategic_topic', 'buyer_private');
--> statement-breakpoint
SELECT app_apply_layer('strategic_topic_objective', 'buyer_private');
