import { createFileRoute } from '@tanstack/react-router';
import { JbpCommitmentFormPage } from '@/features/jbp/jbp-commitment-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/plan/zusagen/neu')({
  component: function Page() {
    const { id } = Route.useParams();
    return <JbpCommitmentFormPage place={{ side: 'buyer', relationshipId: id }} />;
  },
});
