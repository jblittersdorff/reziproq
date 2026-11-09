import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { JbpVersionsPage } from '@/features/jbp/jbp-approval-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/plan/versionen')({
  validateSearch: z.object({
    von: z.number().int().positive().optional(),
    bis: z.number().int().positive().optional(),
  }),
  component: function Page() {
    const { id } = Route.useParams();
    const { von, bis } = Route.useSearch();
    return <JbpVersionsPage place={{ side: 'buyer', relationshipId: id }} from={von} to={bis} />;
  },
});
