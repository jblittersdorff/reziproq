CREATE TABLE "user_setting" (
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"start_page" text NOT NULL,
	CONSTRAINT "user_setting_org_id_user_id_pk" PRIMARY KEY("org_id","user_id"),
	CONSTRAINT "user_setting_start_page" CHECK ("user_setting"."start_page" in ('overview', 'my_day'))
);
--> statement-breakpoint
ALTER TABLE "user_setting" ADD CONSTRAINT "user_setting_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_setting" ADD CONSTRAINT "user_setting_user_id_app_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
SELECT app_apply_layer('user_setting', 'org_private');
--> statement-breakpoint
CREATE POLICY user_setting_own ON user_setting AS RESTRICTIVE FOR ALL TO reziproq_app
USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());
