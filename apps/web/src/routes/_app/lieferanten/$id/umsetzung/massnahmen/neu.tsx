import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { NewActionPage } from '@/features/actions/action-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/umsetzung/massnahmen/neu')({
  // ?termin=<id>: Maßnahme aus einem Termin (QBR-03)
  validateSearch: z.object({ termin: z.uuid().optional() }),
  component: function Page() {
    const { id } = Route.useParams();
    const { termin } = Route.useSearch();
    return (
      <NewActionPage
        place={{ side: 'buyer', relationshipId: id }}
        {...(termin ? { meetingId: termin } : {})}
      />
    );
  },
});
