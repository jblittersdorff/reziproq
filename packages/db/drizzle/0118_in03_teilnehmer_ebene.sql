-- IN-03: Ebene neu anwenden, seit meeting_attendee die Beziehung trägt (0117). app_apply_layer legt
-- die Policies neu an; die alten fallen vorher weg.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE tablename = 'meeting_attendee' LOOP
    EXECUTE format('DROP POLICY %I ON meeting_attendee', p.policyname);
  END LOOP;
END
$$;--> statement-breakpoint
SELECT app_apply_layer('meeting_attendee', 'org_private');
