import { createFileRoute } from '@tanstack/react-router';
import { SupplierProfilePage } from '@/features/suppliers/supplier-profile-page';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/profil/')({
  component: function Profile() {
    const { id } = Route.useParams();
    return <SupplierProfilePage key={id} relationshipId={id} />;
  },
});
