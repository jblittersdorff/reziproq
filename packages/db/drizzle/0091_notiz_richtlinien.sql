-- NAV-10: Die Datenbank erzwingt nur „privat sieht nur die Autorin“ und „anlegen nur als man
-- selbst“. Wer eine Notiz bearbeiten oder löschen darf, prüft der Dienst (nur die Autorin).
DROP POLICY note_private_author ON note;--> statement-breakpoint
CREATE POLICY note_private_author ON note AS RESTRICTIVE FOR ALL TO reziproq_app
USING (visibility = 'team' OR author_user_id = app_current_user_id());--> statement-breakpoint
CREATE POLICY note_insert_self ON note AS RESTRICTIVE FOR INSERT TO reziproq_app
WITH CHECK (author_user_id = app_current_user_id());
