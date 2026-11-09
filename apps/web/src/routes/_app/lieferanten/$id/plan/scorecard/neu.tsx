import { createFileRoute } from '@tanstack/react-router';
import { JbpKpiFormPage } from '@/features/jbp/jbp-scorecard-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/plan/scorecard/neu')({
  component: function Page() {
    const { id } = Route.useParams();
    return <JbpKpiFormPage place={{ side: 'buyer', relationshipId: id }} />;
  },
});
