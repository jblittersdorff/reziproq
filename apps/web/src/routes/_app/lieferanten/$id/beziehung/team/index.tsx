import { createFileRoute } from '@tanstack/react-router';
import { TeamPage } from '@/features/suppliers/team-page';

export const Route = createFileRoute('/_app/lieferanten/$id/beziehung/team/')({
  component: function Team() {
    const { id } = Route.useParams();
    return <TeamPage key={id} relationshipId={id} />;
  },
});
