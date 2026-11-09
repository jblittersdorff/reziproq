import { createFileRoute } from '@tanstack/react-router';
import { MaturityPage } from '@/features/impact/impact-pages';

export const Route = createFileRoute(
  '/_app/lieferanten/$id/wirkung/initiativen/$initiativeId/reifegrad',
)({
  component: function Page() {
    const { id, initiativeId } = Route.useParams();
    return <MaturityPage relationshipId={id} initiativeId={initiativeId} />;
  },
});
