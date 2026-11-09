import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { JbpInitiativesPage } from '@/features/jbp/jbp-initiative-pages';

export const Route = createFileRoute('/_app/kunden/$id/plan/initiativen/')({
  validateSearch: z.object({ ansicht: z.enum(['liste', 'roadmap']).optional() }),
  component: function Page() {
    const { id } = Route.useParams();
    const { ansicht } = Route.useSearch();
    return (
      <JbpInitiativesPage
        place={{ side: 'supplier', relationshipId: id }}
        view={ansicht ?? 'liste'}
      />
    );
  },
});
