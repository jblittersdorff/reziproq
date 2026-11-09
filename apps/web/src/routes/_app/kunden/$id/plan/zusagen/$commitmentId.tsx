import { createFileRoute } from '@tanstack/react-router';
import { JbpCommitmentFormPage } from '@/features/jbp/jbp-commitment-pages';

export const Route = createFileRoute('/_app/kunden/$id/plan/zusagen/$commitmentId')({
  component: function Page() {
    const { id, commitmentId } = Route.useParams();
    return (
      <JbpCommitmentFormPage
        place={{ side: 'supplier', relationshipId: id }}
        commitmentId={commitmentId}
      />
    );
  },
});
