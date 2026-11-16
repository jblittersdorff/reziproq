import { createFileRoute } from '@tanstack/react-router';
import { NextCyclePage } from '@/features/workspace/next-cycle-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/zyklus/neu')({
  component: function SupplierCycleNew() {
    const { id } = Route.useParams();
    return <NextCyclePage relationshipId={id} />;
  },
});
