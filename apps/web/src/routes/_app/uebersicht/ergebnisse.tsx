import { impactViews } from '@reziproq/shared';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { PortfolioImpactPage } from '@/features/impact/portfolio-pages';

// PNL-10: Wirkung aller Fokuslieferanten; Sicht und Geschäftsjahr in der Adresse.
export const Route = createFileRoute('/_app/uebersicht/ergebnisse')({
  validateSearch: z.object({
    sicht: z.enum(impactViews).optional().catch(undefined),
    gj: z.coerce.number().int().min(2000).max(2100).optional().catch(undefined),
  }),
  component: function Impact() {
    return <PortfolioImpactPage search={Route.useSearch()} />;
  },
});
