-- ZQ-01 (K2-a.3): Die Maßnahmen sind mit 0143 zu Zusagen und Aufgaben geworden. Ihre Tabellen und
-- Funktionen entfallen: Den Status geteilter Zusagen ändert app_zusage_status (0141), die
-- Erinnerungen finden ihre Organisationen über app_zusagen_due_orgs (0143).
DROP FUNCTION app_massnahme_status(uuid, text);--> statement-breakpoint
DROP FUNCTION app_action_due_orgs(date, date);--> statement-breakpoint
DROP TABLE "action" CASCADE;--> statement-breakpoint
DROP TABLE "action_notification" CASCADE;--> statement-breakpoint
DROP TABLE "action_private_source" CASCADE;