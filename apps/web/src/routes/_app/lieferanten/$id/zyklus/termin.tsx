import { createFileRoute } from '@tanstack/react-router';
import { CycleDatePage } from '@/features/workspace/cycle-date-page';

export const Route = createFileRoute('/_app/lieferanten/$id/zyklus/termin')({
  component: function SupplierCycleDate() {
    const { id } = Route.useParams();
    return <CycleDatePage relationshipId={id} />;
  },
});
