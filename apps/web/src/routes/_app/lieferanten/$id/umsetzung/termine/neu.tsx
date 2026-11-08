import { createFileRoute } from '@tanstack/react-router';
import { NewMeetingPage } from '@/features/meetings/meeting-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/umsetzung/termine/neu')({
  component: function Page() {
    const { id } = Route.useParams();
    return <NewMeetingPage place={{ side: 'buyer', relationshipId: id }} />;
  },
});
