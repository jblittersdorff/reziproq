import { createFileRoute } from '@tanstack/react-router';
import { JbpScorecardSignPage } from '@/features/jbp/jbp-scorecard-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/plan/scorecard/unterschreiben')({
  component: function Page() {
    const { id } = Route.useParams();
    return <JbpScorecardSignPage place={{ side: 'buyer', relationshipId: id }} />;
  },
});
