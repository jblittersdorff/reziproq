import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { SupplierSpendPage } from '@/features/suppliers/supplier-spend-page';

// SPL-04: ?nach=warengruppe stapelt nach Warengruppe, sonst nach Business Unit.
export const Route = createFileRoute('/_app/lieferanten/$id/strategie/spend/')({
  validateSearch: z.object({ nach: z.enum(['bu', 'warengruppe']).optional().catch(undefined) }),
  component: function Spend() {
    const { id } = Route.useParams();
    const { nach } = Route.useSearch();
    return <SupplierSpendPage key={id} relationshipId={id} by={nach ?? 'bu'} />;
  },
});
