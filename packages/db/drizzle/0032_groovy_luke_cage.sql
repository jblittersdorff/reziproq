ALTER TABLE "objective_category" DROP CONSTRAINT "objective_category_org_id_key_pk";--> statement-breakpoint
ALTER TABLE "objective_category" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL;--> statement-breakpoint
ALTER TABLE "objective_category" ADD CONSTRAINT "objective_category_org_key" UNIQUE("org_id","key");