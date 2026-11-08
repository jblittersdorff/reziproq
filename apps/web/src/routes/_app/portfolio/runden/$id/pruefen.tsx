import { createFileRoute } from '@tanstack/react-router';
import { RoundReviewPage } from '@/features/rounds/round-wizard';

export const Route = createFileRoute('/_app/portfolio/runden/$id/pruefen')({
  component: function Page() {
    const { id } = Route.useParams();
    return <RoundReviewPage id={id} key={id} />;
  },
});
