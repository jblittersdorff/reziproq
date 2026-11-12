import { createFileRoute } from '@tanstack/react-router';
import { ImpactSetupPage } from '@/features/impact/impact-pages';

export const Route = createFileRoute(
  '/_app/lieferanten/$id/wirkung/initiativen/$initiativeId/einrichten',
)({
  component: function Page() {
    const { id, initiativeId } = Route.useParams();
    return <ImpactSetupPage relationshipId={id} initiativeId={initiativeId} />;
  },
});
