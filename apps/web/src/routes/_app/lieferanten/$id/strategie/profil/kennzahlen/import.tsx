import { createFileRoute } from '@tanstack/react-router';
import { FinancialImportPage } from '@/features/suppliers/profile-finance';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/profil/kennzahlen/import')({
  component: function ImportFinancials() {
    const { id } = Route.useParams();
    return <FinancialImportPage key={id} relationshipId={id} />;
  },
});
