import { createFileRoute } from '@tanstack/react-router';
import { HintsPage } from '@/features/hints/hints-pages';

export const Route = createFileRoute('/_app/hinweise/')({
  component: HintsPage,
});
