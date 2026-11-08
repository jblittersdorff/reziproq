import { createFileRoute } from '@tanstack/react-router';
import { CustomerOverviewPage } from '@/features/customers/customer-workspace';

export const Route = createFileRoute('/_app/kunden/$id/')({
  component: function Overview() {
    const { id } = Route.useParams();
    return <CustomerOverviewPage relationshipId={id} />;
  },
});
