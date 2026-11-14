import { createFileRoute } from '@tanstack/react-router';
import { ActionRemindersPage } from '@/features/settings/action-reminders-page';

export const Route = createFileRoute('/_app/einstellungen/erinnerungen')({
  component: ActionRemindersPage,
});
