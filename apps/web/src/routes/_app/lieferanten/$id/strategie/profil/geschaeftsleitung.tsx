import { createFileRoute } from '@tanstack/react-router';
import { ExecutivesEditPage } from '@/features/suppliers/profile-finance';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/profil/geschaeftsleitung')({
  component: function EditExecutives() {
    const { id } = Route.useParams();
    return <ExecutivesEditPage key={id} relationshipId={id} />;
  },
});
