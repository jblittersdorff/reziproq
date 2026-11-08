import { createFileRoute } from '@tanstack/react-router';
import { DuePage } from '@/features/start/due-page';

export const Route = createFileRoute('/_app/start/faellig')({
  component: DuePage,
});
