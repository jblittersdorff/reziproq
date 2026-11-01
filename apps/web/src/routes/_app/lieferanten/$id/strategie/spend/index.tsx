import { createFileRoute } from '@tanstack/react-router';
import { SupplierSpendPage } from '@/features/suppliers/supplier-spend-page';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/spend/')({
  component: function Spend() {
    const { id } = Route.useParams();
    return <SupplierSpendPage key={id} relationshipId={id} />;
  },
});
