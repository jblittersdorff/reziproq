import { createFileRoute } from '@tanstack/react-router';
import { BaselinePage } from '@/features/impact/impact-pages';

export const Route = createFileRoute(
  '/_app/lieferanten/$id/wirkung/initiativen/$initiativeId/baseline',
)({
  component: function Page() {
    const { id, initiativeId } = Route.useParams();
    return <BaselinePage relationshipId={id} initiativeId={initiativeId} />;
  },
});
