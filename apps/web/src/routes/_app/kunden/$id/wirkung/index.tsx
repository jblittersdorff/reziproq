import { createFileRoute } from '@tanstack/react-router';
import { CustomerImpactPage } from '@/features/impact/sharing-pages';

export const Route = createFileRoute('/_app/kunden/$id/wirkung/')({
  component: function Impact() {
    const { id } = Route.useParams();
    return <CustomerImpactPage key={id} relationshipId={id} />;
  },
});
