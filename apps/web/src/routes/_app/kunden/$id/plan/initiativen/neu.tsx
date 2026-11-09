import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { JbpInitiativeFormPage } from '@/features/jbp/jbp-initiative-pages';

export const Route = createFileRoute('/_app/kunden/$id/plan/initiativen/neu')({
  validateSearch: z.object({ themen: z.string().max(800).optional() }),
  component: function Page() {
    const { id } = Route.useParams();
    const { themen } = Route.useSearch();
    return (
      <JbpInitiativeFormPage
        place={{ side: 'supplier', relationshipId: id }}
        topicIds={themen ? themen.split(',').filter(Boolean) : []}
      />
    );
  },
});
