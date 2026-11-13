import { createFileRoute } from '@tanstack/react-router';
import { ImpactImportPage } from '@/features/impact/impact-pages';

export const Route = createFileRoute(
  '/_app/lieferanten/$id/wirkung/initiativen/$initiativeId/import',
)({
  component: function Page() {
    const { id, initiativeId } = Route.useParams();
    return <ImpactImportPage relationshipId={id} initiativeId={initiativeId} />;
  },
});
