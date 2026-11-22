ALTER TABLE "model_call" DROP CONSTRAINT "model_call_org_id_organization_id_fk";
--> statement-breakpoint
ALTER TABLE "model_call" ADD CONSTRAINT "model_call_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;