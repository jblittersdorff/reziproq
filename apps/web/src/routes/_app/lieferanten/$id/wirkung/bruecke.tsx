import { impactViews } from '@reziproq/shared';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { BridgePage } from '@/features/impact/portfolio-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/wirkung/bruecke')({
  validateSearch: z.object({
    sicht: z.enum(impactViews).optional().catch(undefined),
    gj: z.coerce.number().int().min(2000).max(2100).optional().catch(undefined),
  }),
  component: function Bridge() {
    const { id } = Route.useParams();
    return <BridgePage key={id} relationshipId={id} search={Route.useSearch()} />;
  },
});
