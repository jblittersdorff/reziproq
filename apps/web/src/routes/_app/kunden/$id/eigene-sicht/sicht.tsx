import { createFileRoute } from '@tanstack/react-router';
import { OwnViewEditPage } from '@/features/customers/own-view-pages';

export const Route = createFileRoute('/_app/kunden/$id/eigene-sicht/sicht')({
  component: function Page() {
    const params = Route.useParams();
    return <OwnViewEditPage relationshipId={params.id} />;
  },
});
