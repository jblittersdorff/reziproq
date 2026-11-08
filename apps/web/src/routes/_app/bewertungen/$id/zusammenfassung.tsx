import { createFileRoute } from '@tanstack/react-router';
import { RatingPage } from '@/features/ratings/rating-page';

export const Route = createFileRoute('/_app/bewertungen/$id/zusammenfassung')({
  component: function Page() {
    const { id } = Route.useParams();
    return <RatingPage id={id} step={3} key={id} />;
  },
});
