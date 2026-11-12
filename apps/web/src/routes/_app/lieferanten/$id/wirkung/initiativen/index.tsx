import { createFileRoute } from '@tanstack/react-router';
import { ImpactListPage } from '@/features/impact/impact-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/wirkung/initiativen/')({
  component: function Page() {
    const { id } = Route.useParams();
    return <ImpactListPage relationshipId={id} />;
  },
});
