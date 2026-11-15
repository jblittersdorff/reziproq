import { createFileRoute } from '@tanstack/react-router';
import { FinancialFormPage } from '@/features/suppliers/profile-finance';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/profil/kennzahlen/neu')({
  component: function NewFinancial() {
    const { id } = Route.useParams();
    return <FinancialFormPage key={id} relationshipId={id} />;
  },
});
