import { impactViews } from '@reziproq/shared';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { z } from 'zod';

// PNL-10: Wirkung aller Fokuslieferanten; Sicht und Geschäftsjahr in der Adresse.
export const Route = createFileRoute('/_app/wirkung/')({
  validateSearch: z.object({
    sicht: z.enum(impactViews).optional().catch(undefined),
    gj: z.coerce.number().int().min(2000).max(2100).optional().catch(undefined),
  }),
  component: () => <Navigate to="/uebersicht" search={Route.useSearch()} replace />,
});
