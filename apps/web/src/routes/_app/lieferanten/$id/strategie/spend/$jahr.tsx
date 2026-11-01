import { createFileRoute } from '@tanstack/react-router';
import { NotFoundPage } from '@/features/shell/not-found-page';
import { SpendFormPage } from '@/features/suppliers/spend-form-page';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/spend/$jahr')({
  component: function EditSpend() {
    const { id, jahr } = Route.useParams();
    // Nur vierstellige Jahre; alles andere ist keine Seite.
    if (!/^\d{4}$/.test(jahr)) return <NotFoundPage />;
    return <SpendFormPage key={`${id}-${jahr}`} relationshipId={id} year={Number(jahr)} />;
  },
});
