import { createFileRoute } from '@tanstack/react-router';
import { AssignmentPage } from '@/features/master-data/assignment-page';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/profil/zuordnung')({
  component: function Assignment() {
    const { id } = Route.useParams();
    return <AssignmentPage key={id} relationshipId={id} />;
  },
});
