import { createFileRoute } from '@tanstack/react-router';
import { MeetingPage } from '@/features/meetings/meeting-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/umsetzung/termine/$meetingId/')({
  component: function Page() {
    const { id, meetingId } = Route.useParams();
    return (
      <MeetingPage
        key={meetingId}
        place={{ side: 'buyer', relationshipId: id }}
        meetingId={meetingId}
      />
    );
  },
});
