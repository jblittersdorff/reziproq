import { createFileRoute } from '@tanstack/react-router';
import { JbpInitiativeFormPage } from '@/features/jbp/jbp-initiative-pages';

export const Route = createFileRoute('/_app/kunden/$id/plan/initiativen/$initiativeId/bearbeiten')({
  component: function Page() {
    const { id, initiativeId } = Route.useParams();
    return (
      <JbpInitiativeFormPage
        place={{ side: 'supplier', relationshipId: id }}
        initiativeId={initiativeId}
      />
    );
  },
});
