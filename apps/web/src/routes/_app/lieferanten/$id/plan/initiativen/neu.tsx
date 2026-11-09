import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { JbpInitiativeFormPage } from '@/features/jbp/jbp-initiative-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/plan/initiativen/neu')({
  validateSearch: z.object({ themen: z.string().max(800).optional() }),
  component: function Page() {
    const { id } = Route.useParams();
    const { themen } = Route.useSearch();
    return (
      <JbpInitiativeFormPage
        place={{ side: 'buyer', relationshipId: id }}
        topicIds={themen ? themen.split(',').filter(Boolean) : []}
      />
    );
  },
});
