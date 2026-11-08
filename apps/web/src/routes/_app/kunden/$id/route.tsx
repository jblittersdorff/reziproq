import { createFileRoute } from '@tanstack/react-router';
import { CustomerWorkspaceLayout } from '@/features/customers/customer-workspace';

// Arbeitsbereich eines Kunden (LIF-02): lokale Leiste für alle Seiten darunter.
export const Route = createFileRoute('/_app/kunden/$id')({
  component: function Workspace() {
    const { id } = Route.useParams();
    return <CustomerWorkspaceLayout key={id} relationshipId={id} />;
  },
});
