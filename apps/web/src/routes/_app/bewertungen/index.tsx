import { createFileRoute } from '@tanstack/react-router';
import { RatingsPage } from '@/features/ratings/ratings-page';

export const Route = createFileRoute('/_app/bewertungen/')({
  component: RatingsPage,
});
