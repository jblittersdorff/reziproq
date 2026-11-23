import { createFileRoute, Navigate } from '@tanstack/react-router';
import { z } from 'zod';

// NAV-10: /portfolio ist die Ansicht Matrix der Lieferanten. WG-18: ?warengruppe=<id> (oder wg)
// filtert die Matrix nach Warengruppe.
export const Route = createFileRoute('/_app/portfolio/')({
  validateSearch: z.object({
    warengruppe: z.uuid().optional().catch(undefined),
    wg: z.uuid().optional().catch(undefined),
  }),
  component: function PortfolioRedirect() {
    const { warengruppe, wg } = Route.useSearch();
    const group = warengruppe ?? wg;
    return (
      <Navigate
        to="/lieferanten"
        search={{ ansicht: 'matrix', ...(group ? { wg: group } : {}) }}
        replace
      />
    );
  },
});
