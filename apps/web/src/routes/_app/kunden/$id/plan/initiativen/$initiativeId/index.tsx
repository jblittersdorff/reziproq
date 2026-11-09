import { createFileRoute } from '@tanstack/react-router';
import { JbpInitiativePage } from '@/features/jbp/jbp-initiative-pages';

export const Route = createFileRoute('/_app/kunden/$id/plan/initiativen/$initiativeId/')({
  component: function Page() {
    const { id, initiativeId } = Route.useParams();
    return (
      <JbpInitiativePage
        place={{ side: 'supplier', relationshipId: id }}
        initiativeId={initiativeId}
      />
    );
  },
});
