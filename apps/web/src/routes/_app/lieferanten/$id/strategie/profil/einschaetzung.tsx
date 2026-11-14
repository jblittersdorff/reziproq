import { createFileRoute } from '@tanstack/react-router';
import { ImplicationsEditPage } from '@/features/suppliers/profile-finance';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/profil/einschaetzung')({
  component: function EditImplications() {
    const { id } = Route.useParams();
    return <ImplicationsEditPage key={id} relationshipId={id} />;
  },
});
