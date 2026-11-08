import { createFileRoute } from '@tanstack/react-router';
import { EditActionPage } from '@/features/actions/action-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/umsetzung/massnahmen/$actionId')({
  component: function Page() {
    const { id, actionId } = Route.useParams();
    return <EditActionPage place={{ side: 'buyer', relationshipId: id }} actionId={actionId} />;
  },
});
