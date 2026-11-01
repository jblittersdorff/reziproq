import { createFileRoute } from '@tanstack/react-router';
import { SupplierWorkspace } from '@/features/workspace/supplier-workspace';

// Arbeitsbereich eines Lieferanten (NAV-06): lokale Leiste und Kopf für alle Seiten darunter.
export const Route = createFileRoute('/_app/lieferanten/$id')({
  component: function Workspace() {
    const { id } = Route.useParams();
    return <SupplierWorkspace key={id} relationshipId={id} />;
  },
});
