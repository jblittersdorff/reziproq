import { createFileRoute } from '@tanstack/react-router';
import { CompanyEditPage } from '@/features/suppliers/profile-finance';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/profil/unternehmen')({
  component: function EditCompany() {
    const { id } = Route.useParams();
    return <CompanyEditPage key={id} relationshipId={id} />;
  },
});
