ALTER TABLE "agent_run" ADD COLUMN "context_relationship_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "job_ticket" uuid;--> statement-breakpoint
CREATE INDEX "ai_draft_run" ON "ai_draft" USING btree ("org_id","run_id");--> statement-breakpoint
CREATE INDEX "model_call_org_run" ON "model_call" USING btree ("org_id","run_id");