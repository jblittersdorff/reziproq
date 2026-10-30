import { createFileRoute } from '@tanstack/react-router';
import { CallbackPage } from '@/features/auth/callback-page';

export const Route = createFileRoute('/auth/callback')({
  component: CallbackPage,
});
