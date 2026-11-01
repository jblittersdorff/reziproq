import { createFileRoute } from '@tanstack/react-router';
import { SpendFormPage } from '@/features/suppliers/spend-form-page';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/spend/neu')({
  component: function NewSpend() {
    const { id } = Route.useParams();
    return <SpendFormPage key={id} relationshipId={id} />;
  },
});
