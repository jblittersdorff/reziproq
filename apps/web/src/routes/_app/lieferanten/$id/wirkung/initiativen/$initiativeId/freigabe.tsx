import { createFileRoute } from '@tanstack/react-router';
import { RequestValidationPage } from '@/features/impact/impact-pages';

export const Route = createFileRoute(
  '/_app/lieferanten/$id/wirkung/initiativen/$initiativeId/freigabe',
)({
  component: function Page() {
    const { id, initiativeId } = Route.useParams();
    return <RequestValidationPage relationshipId={id} initiativeId={initiativeId} />;
  },
});
