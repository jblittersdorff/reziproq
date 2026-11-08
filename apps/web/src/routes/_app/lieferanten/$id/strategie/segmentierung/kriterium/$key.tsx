import { createFileRoute } from '@tanstack/react-router';
import { CriterionPage } from '@/features/segmentation/criterion-page';

export const Route = createFileRoute(
  '/_app/lieferanten/$id/strategie/segmentierung/kriterium/$key',
)({
  component: function Criterion() {
    const { id, key } = Route.useParams();
    return <CriterionPage key={`${id}:${key}`} relationshipId={id} criterionKey={key} />;
  },
});
