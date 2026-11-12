import { createFileRoute } from '@tanstack/react-router';
import { JbpKpiValuePage } from '@/features/jbp/jbp-scorecard-pages';

export const Route = createFileRoute('/_app/kunden/$id/plan/scorecard/$kpiId/wert')({
  component: function Page() {
    const { id, kpiId } = Route.useParams();
    return <JbpKpiValuePage place={{ side: 'supplier', relationshipId: id }} kpiId={kpiId} />;
  },
});
