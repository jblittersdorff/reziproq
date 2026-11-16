ALTER TABLE "jbp_cycle_link" DROP CONSTRAINT "jbp_cycle_link_once";--> statement-breakpoint
ALTER TABLE "cycle" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jbp_cycle_link" ADD CONSTRAINT "jbp_cycle_link_once" UNIQUE("jbp_id","cycle_id");