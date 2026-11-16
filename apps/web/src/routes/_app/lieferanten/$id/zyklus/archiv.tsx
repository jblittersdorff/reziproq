import { createFileRoute } from '@tanstack/react-router';
import { CycleArchivePage } from '@/features/workspace/next-cycle-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/zyklus/archiv')({
  component: function SupplierCycleArchive() {
    const { id } = Route.useParams();
    return <CycleArchivePage relationshipId={id} />;
  },
});
