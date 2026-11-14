import { createFileRoute } from '@tanstack/react-router';
import { RolePage } from '@/features/suppliers/team-page';

export const Route = createFileRoute('/_app/lieferanten/$id/beziehung/team/sro')({
  component: function SroRole() {
    const { id } = Route.useParams();
    return <RolePage key={id} relationshipId={id} />;
  },
});
