import { createFileRoute } from '@tanstack/react-router';
import { MeetingEditPage } from '@/features/meetings/meeting-pages';

export const Route = createFileRoute(
  '/_app/lieferanten/$id/umsetzung/termine/$meetingId/protokoll',
)({
  component: function Page() {
    const { id, meetingId } = Route.useParams();
    return (
      <MeetingEditPage
        key={meetingId}
        place={{ side: 'buyer', relationshipId: id }}
        meetingId={meetingId}
        kind="protocol"
      />
    );
  },
});
