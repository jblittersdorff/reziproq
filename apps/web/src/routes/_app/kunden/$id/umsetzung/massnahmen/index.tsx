import { actionStatuses } from '@reziproq/shared';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ActionsPage } from '@/features/actions/action-pages';

export const Route = createFileRoute('/_app/kunden/$id/umsetzung/massnahmen/')({
  validateSearch: z.object({
    status: z.enum(['alle', ...actionStatuses]).optional(),
    seite: z.enum(['buyer', 'supplier']).optional(),
    person: z.string().max(120).optional(),
  }),
  component: function Page() {
    const { id } = Route.useParams();
    const filter = Route.useSearch();
    return <ActionsPage place={{ side: 'supplier', relationshipId: id }} filter={filter} />;
  },
});
