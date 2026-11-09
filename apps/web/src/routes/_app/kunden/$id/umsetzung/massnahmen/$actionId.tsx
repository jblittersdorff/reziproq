import { createFileRoute } from '@tanstack/react-router';
import { EditActionPage } from '@/features/actions/action-pages';

export const Route = createFileRoute('/_app/kunden/$id/umsetzung/massnahmen/$actionId')({
  component: function Page() {
    const { id, actionId } = Route.useParams();
    return <EditActionPage place={{ side: 'supplier', relationshipId: id }} actionId={actionId} />;
  },
});
