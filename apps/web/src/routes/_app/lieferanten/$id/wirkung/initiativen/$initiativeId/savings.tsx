import { createFileRoute } from '@tanstack/react-router';
import { SavingsReferencePage } from '@/features/impact/sharing-pages';

export const Route = createFileRoute(
  '/_app/lieferanten/$id/wirkung/initiativen/$initiativeId/savings',
)({
  component: function EditSavings() {
    const { id, initiativeId } = Route.useParams();
    return (
      <SavingsReferencePage key={initiativeId} relationshipId={id} initiativeId={initiativeId} />
    );
  },
});
