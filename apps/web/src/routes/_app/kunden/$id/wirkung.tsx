import { createFileRoute } from '@tanstack/react-router';
import { CustomerAreaPage } from '@/features/customers/customer-workspace';

export const Route = createFileRoute('/_app/kunden/$id/wirkung')({
  component: function Impact() {
    const { id } = Route.useParams();
    return <CustomerAreaPage relationshipId={id} area="impact" />;
  },
});
