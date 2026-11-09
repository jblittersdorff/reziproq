import { createFileRoute } from '@tanstack/react-router';
import { JbpCommitmentsPage } from '@/features/jbp/jbp-commitment-pages';

export const Route = createFileRoute('/_app/kunden/$id/plan/zusagen/')({
  component: function Page() {
    const { id } = Route.useParams();
    return <JbpCommitmentsPage place={{ side: 'supplier', relationshipId: id }} />;
  },
});
