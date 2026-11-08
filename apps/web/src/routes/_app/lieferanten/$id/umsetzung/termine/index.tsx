import { createFileRoute } from '@tanstack/react-router';
import { MeetingsPage } from '@/features/meetings/meeting-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/umsetzung/termine/')({
  component: function Page() {
    const { id } = Route.useParams();
    return <MeetingsPage place={{ side: 'buyer', relationshipId: id }} />;
  },
});
