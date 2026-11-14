import { createFileRoute } from '@tanstack/react-router';
import { SpendFormPage } from '@/features/suppliers/spend-form-page';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/spend/$eintrag')({
  component: function EditSpend() {
    const { id, eintrag } = Route.useParams();
    return <SpendFormPage key={eintrag} relationshipId={id} entryId={eintrag} />;
  },
});
