import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { CustomersPage } from '@/features/customers/customers-page';

// Kunden der Lieferantenseite (LIF-02); ?bereich= kommt vom Kundenwechsel.
export const Route = createFileRoute('/_app/kunden/')({
  validateSearch: z.object({ bereich: z.string().optional() }),
  component: function Customers() {
    const { bereich } = Route.useSearch();
    return <CustomersPage area={bereich} />;
  },
});
