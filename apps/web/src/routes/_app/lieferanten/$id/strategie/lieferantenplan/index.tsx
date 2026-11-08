import { createFileRoute } from '@tanstack/react-router';
import { SupplierPlanPage } from '@/features/supplier-plan/plan-page';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/lieferantenplan/')({
  component: function SupplierPlan() {
    const { id } = Route.useParams();
    return <SupplierPlanPage relationshipId={id} />;
  },
});
