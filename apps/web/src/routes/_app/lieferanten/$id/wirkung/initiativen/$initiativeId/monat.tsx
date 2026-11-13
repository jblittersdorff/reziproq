import { createFileRoute } from '@tanstack/react-router';
import { ImpactMonthPage } from '@/features/impact/impact-pages';

export const Route = createFileRoute(
  '/_app/lieferanten/$id/wirkung/initiativen/$initiativeId/monat',
)({
  component: function Page() {
    const { id, initiativeId } = Route.useParams();
    return <ImpactMonthPage relationshipId={id} initiativeId={initiativeId} />;
  },
});
