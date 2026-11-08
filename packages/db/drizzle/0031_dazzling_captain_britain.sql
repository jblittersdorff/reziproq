ALTER TABLE "cycle" ADD CONSTRAINT "cycle_id_relationship" UNIQUE("id","relationship_id");--> statement-breakpoint
ALTER TABLE "plan_objective" DROP CONSTRAINT "plan_objective_unique_target";--> statement-breakpoint
ALTER TABLE "supplier_plan" DROP CONSTRAINT "supplier_plan_cycle_id_cycle_id_fk";--> statement-breakpoint
ALTER TABLE "supplier_plan" ADD CONSTRAINT "supplier_plan_cycle_relationship_fk" FOREIGN KEY ("cycle_id","relationship_id") REFERENCES "public"."cycle"("id","relationship_id") ON DELETE no action ON UPDATE no action;