import { impactViews } from '@reziproq/shared';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { CustomerImpactPage } from '@/features/impact/sharing-pages';

export const Route = createFileRoute('/_app/kunden/$id/wirkung/')({
  validateSearch: z.object({
    sicht: z.enum(impactViews).optional().catch(undefined),
    gj: z.coerce.number().int().min(2000).max(2100).optional().catch(undefined),
  }),
  component: function Impact() {
    const { id } = Route.useParams();
    return <CustomerImpactPage key={id} relationshipId={id} search={Route.useSearch()} />;
  },
});
