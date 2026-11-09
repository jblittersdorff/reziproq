import { createFileRoute } from '@tanstack/react-router';
import { JbpApprovalPage } from '@/features/jbp/jbp-approval-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/plan/freigabe')({
  component: function Page() {
    const { id } = Route.useParams();
    return <JbpApprovalPage place={{ side: 'buyer', relationshipId: id }} />;
  },
});
