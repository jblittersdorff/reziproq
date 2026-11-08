import { createFileRoute } from '@tanstack/react-router';
import { CustomerRulesPage } from '@/features/customers/customer-workspace';

export const Route = createFileRoute('/_app/kunden/$id/beziehung/spielregeln')({
  component: function Page() {
    const { id } = Route.useParams();
    return <CustomerRulesPage relationshipId={id} />;
  },
});
