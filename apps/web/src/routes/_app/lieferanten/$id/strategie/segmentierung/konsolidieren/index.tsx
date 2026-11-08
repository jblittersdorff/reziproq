import { createFileRoute } from '@tanstack/react-router';
import { ConsolidatePage } from '@/features/segmentation/consolidate-page';

export const Route = createFileRoute(
  '/_app/lieferanten/$id/strategie/segmentierung/konsolidieren/',
)({
  component: function Consolidate() {
    const { id } = Route.useParams();
    return <ConsolidatePage key={id} relationshipId={id} />;
  },
});
