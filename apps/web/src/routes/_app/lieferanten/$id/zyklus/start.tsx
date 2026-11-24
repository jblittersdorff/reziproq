import { createFileRoute } from '@tanstack/react-router';
import { CycleStartPage } from '@/features/workspace/cycle-start-page';

// NAV-10 1.1: Ziel von „Als Nächstes“ für einen Fokuslieferanten ohne Jahreszyklus (ZYK-01)
export const Route = createFileRoute('/_app/lieferanten/$id/zyklus/start')({
  component: function SupplierCycleStart() {
    const { id } = Route.useParams();
    return <CycleStartPage relationshipId={id} />;
  },
});
