import { createFileRoute } from '@tanstack/react-router';
import { OwnViewPage } from '@/features/customers/own-view-pages';

export const Route = createFileRoute('/_app/kunden/$id/eigene-sicht/')({
  component: function Page() {
    const params = Route.useParams();
    return <OwnViewPage relationshipId={params.id} />;
  },
});
