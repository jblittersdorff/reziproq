import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { MeetingPage } from '@/features/meetings/meeting-pages';

const tabs = { vorbereitung: 'prep', agenda: 'agenda', ergebnisse: 'results' } as const;

export const Route = createFileRoute('/_app/lieferanten/$id/umsetzung/termine/$meetingId/')({
  // ?reiter=ergebnisse: öffnet den Reiter, z. B. aus der Aufgabe „Ergebnisse erfassen“ (KI-17)
  validateSearch: z.object({ reiter: z.enum(['vorbereitung', 'agenda', 'ergebnisse']).optional() }),
  component: function Page() {
    const { id, meetingId } = Route.useParams();
    const { reiter } = Route.useSearch();
    return (
      <MeetingPage
        key={meetingId}
        place={{ side: 'buyer', relationshipId: id }}
        meetingId={meetingId}
        initialTab={reiter ? tabs[reiter] : undefined}
      />
    );
  },
});
