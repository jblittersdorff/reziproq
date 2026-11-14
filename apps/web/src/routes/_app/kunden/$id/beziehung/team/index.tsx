import { createFileRoute } from '@tanstack/react-router';
import { TeamPage } from '@/features/suppliers/team-page';

export const Route = createFileRoute('/_app/kunden/$id/beziehung/team/')({
  component: function CustomerTeam() {
    const { id } = Route.useParams();
    return <TeamPage key={id} relationshipId={id} side="supplier" />;
  },
});
