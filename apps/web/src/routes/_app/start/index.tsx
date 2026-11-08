import { createFileRoute } from '@tanstack/react-router';
import { StartPage } from '@/features/start/start-page';

export const Route = createFileRoute('/_app/start/')({
  component: StartPage,
});
