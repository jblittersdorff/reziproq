import { createFileRoute } from '@tanstack/react-router';
import { JbpKpiImportPage } from '@/features/jbp/jbp-scorecard-pages';

export const Route = createFileRoute('/_app/kunden/$id/plan/scorecard/import')({
  component: function Page() {
    const { id } = Route.useParams();
    return <JbpKpiImportPage place={{ side: 'supplier', relationshipId: id }} />;
  },
});
