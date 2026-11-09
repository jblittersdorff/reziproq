import { createFileRoute } from '@tanstack/react-router';
import { JbpCommitmentFormPage } from '@/features/jbp/jbp-commitment-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/plan/zusagen/$commitmentId')({
  component: function Page() {
    const { id, commitmentId } = Route.useParams();
    return (
      <JbpCommitmentFormPage
        place={{ side: 'buyer', relationshipId: id }}
        commitmentId={commitmentId}
      />
    );
  },
});
