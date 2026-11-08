import { createFileRoute } from '@tanstack/react-router';
import { CustomerAreaPage } from '@/features/customers/customer-workspace';

export const Route = createFileRoute('/_app/kunden/$id/plan')({
  component: function Plan() {
    const { id } = Route.useParams();
    return <CustomerAreaPage relationshipId={id} area="plan" />;
  },
});
