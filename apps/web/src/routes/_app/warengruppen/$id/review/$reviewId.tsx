import { createFileRoute } from '@tanstack/react-router';
import { CategoryReviewPage } from '@/features/material-groups/scorecard-pages';

// WG-12: Quartals-Review einer freigegebenen Warengruppenstrategie
export const Route = createFileRoute('/_app/warengruppen/$id/review/$reviewId')({
  component: function CategoryReview() {
    const { id, reviewId } = Route.useParams();
    return <CategoryReviewPage key={reviewId} groupId={id} reviewId={reviewId} />;
  },
});
