import { createFileRoute } from '@tanstack/react-router';
import { ImpactDetailPage } from '@/features/impact/impact-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/wirkung/initiativen/$initiativeId/')({
  component: function Page() {
    const { id, initiativeId } = Route.useParams();
    return <ImpactDetailPage relationshipId={id} initiativeId={initiativeId} />;
  },
});
