import { createFileRoute } from '@tanstack/react-router';
import { JbpKpiValuePage } from '@/features/jbp/jbp-scorecard-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/plan/scorecard/$kpiId/wert')({
  component: function Page() {
    const { id, kpiId } = Route.useParams();
    return <JbpKpiValuePage place={{ side: 'buyer', relationshipId: id }} kpiId={kpiId} />;
  },
});
