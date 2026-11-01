import { createFileRoute } from '@tanstack/react-router';
import { SupplierEditPage } from '@/features/suppliers/supplier-edit-page';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/profil/bearbeiten')({
  component: function Edit() {
    const { id } = Route.useParams();
    return <SupplierEditPage key={id} relationshipId={id} />;
  },
});
