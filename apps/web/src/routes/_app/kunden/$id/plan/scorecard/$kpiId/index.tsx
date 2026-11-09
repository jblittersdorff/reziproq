import { createFileRoute } from '@tanstack/react-router';
import { JbpKpiPage } from '@/features/jbp/jbp-scorecard-pages';

export const Route = createFileRoute('/_app/kunden/$id/plan/scorecard/$kpiId/')({
  component: function Page() {
    const { id, kpiId } = Route.useParams();
    return <JbpKpiPage place={{ side: 'supplier', relationshipId: id }} kpiId={kpiId} />;
  },
});
