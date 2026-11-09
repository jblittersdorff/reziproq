import { createFileRoute } from '@tanstack/react-router';
import { JbpInitiativePage } from '@/features/jbp/jbp-initiative-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/plan/initiativen/$initiativeId/')({
  component: function Page() {
    const { id, initiativeId } = Route.useParams();
    return (
      <JbpInitiativePage
        place={{ side: 'buyer', relationshipId: id }}
        initiativeId={initiativeId}
      />
    );
  },
});
