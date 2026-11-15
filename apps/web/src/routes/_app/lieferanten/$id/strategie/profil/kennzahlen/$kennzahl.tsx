import { createFileRoute } from '@tanstack/react-router';
import { FinancialFormPage } from '@/features/suppliers/profile-finance';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/profil/kennzahlen/$kennzahl')(
  {
    component: function EditFinancial() {
      const { id, kennzahl } = Route.useParams();
      return <FinancialFormPage key={id} relationshipId={id} financialId={kennzahl} />;
    },
  },
);
