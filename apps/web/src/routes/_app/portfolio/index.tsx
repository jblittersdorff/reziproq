import { createFileRoute, Navigate } from '@tanstack/react-router';
import { z } from 'zod';

// NAV-10: /portfolio ist die Ansicht Matrix der Beziehungen (2.0: Linse Segmente mit K2-b). WG-18: ?warengruppe=<id> (oder wg)
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
        to="/beziehungen"
        search={{ ansicht: 'matrix', ...(group ? { wg: group } : {}) }}
        replace
      />
    );
  },
});
