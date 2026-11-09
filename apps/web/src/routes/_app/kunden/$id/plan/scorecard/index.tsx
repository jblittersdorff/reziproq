import { createFileRoute } from '@tanstack/react-router';
import { JbpScorecardPage } from '@/features/jbp/jbp-scorecard-pages';

export const Route = createFileRoute('/_app/kunden/$id/plan/scorecard/')({
  component: function Page() {
    const { id } = Route.useParams();
    return <JbpScorecardPage place={{ side: 'supplier', relationshipId: id }} />;
  },
});
