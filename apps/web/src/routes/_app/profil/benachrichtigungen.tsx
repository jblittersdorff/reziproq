import { createFileRoute } from '@tanstack/react-router';
import { NotificationsPage } from '@/features/profile/notifications-page';

export const Route = createFileRoute('/_app/profil/benachrichtigungen')({
  component: NotificationsPage,
});
