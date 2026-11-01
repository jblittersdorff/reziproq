import { createFileRoute } from '@tanstack/react-router';
import { OverviewPage } from '@/features/workspace/overview-page';

export const Route = createFileRoute('/_app/lieferanten/$id/')({
  component: function Overview() {
    const { id } = Route.useParams();
    return <OverviewPage relationshipId={id} />;
  },
});
