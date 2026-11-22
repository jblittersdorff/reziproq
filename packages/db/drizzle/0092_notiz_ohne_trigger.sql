-- NAV-10: Die Ebene org_private prüft schon, dass die Organisation an der Beziehung beteiligt ist
-- (app_is_relationship_party). Dass nur Käufer Notizen schreiben, prüft der Dienst (Recht
-- notizen.schreiben gilt nur auf der Käuferseite); der Trigger entfällt.
DROP TRIGGER note_owner ON note;--> statement-breakpoint
DROP FUNCTION app_note_owner();
