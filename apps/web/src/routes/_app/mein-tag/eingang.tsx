import { createFileRoute } from '@tanstack/react-router';
import { InboxPage } from '@/features/calendar/inbox-page';

export const Route = createFileRoute('/_app/mein-tag/eingang')({
  component: InboxPage,
});
