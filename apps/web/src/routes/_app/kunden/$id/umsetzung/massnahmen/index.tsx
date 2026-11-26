import { workItemStatuses } from '@reziproq/shared';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ActionsPage } from '@/features/actions/action-pages';

export const Route = createFileRoute('/_app/kunden/$id/umsetzung/massnahmen/')({
  validateSearch: z.object({
    // ZQ-01 (K2-a.3): Status beider Arten; art wie in Heute (zusage, aufgabe)
    status: z.enum(['alle', ...workItemStatuses]).optional(),
    art: z.enum(['zusage', 'aufgabe']).optional(),
    seite: z.enum(['buyer', 'supplier']).optional(),
    person: z.string().max(120).optional(),
  }),
  component: function Page() {
    const { id } = Route.useParams();
    const filter = Route.useSearch();
    return <ActionsPage place={{ side: 'supplier', relationshipId: id }} filter={filter} />;
  },
});
