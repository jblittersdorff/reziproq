import { createFileRoute } from '@tanstack/react-router';
import { TeamEditPage } from '@/features/suppliers/team-edit-page';

export const Route = createFileRoute('/_app/kunden/$id/beziehung/team/bearbeiten')({
  component: function EditCustomerTeam() {
    const { id } = Route.useParams();
    return <TeamEditPage key={id} relationshipId={id} side="supplier" />;
  },
});
