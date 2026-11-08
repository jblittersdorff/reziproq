import { createFileRoute } from '@tanstack/react-router';
import { MeetingEditPage } from '@/features/meetings/meeting-pages';

export const Route = createFileRoute('/_app/kunden/$id/umsetzung/termine/$meetingId/agenda')({
  component: function Page() {
    const { id, meetingId } = Route.useParams();
    return (
      <MeetingEditPage
        key={meetingId}
        place={{ side: 'supplier', relationshipId: id }}
        meetingId={meetingId}
        kind="agenda"
      />
    );
  },
});
