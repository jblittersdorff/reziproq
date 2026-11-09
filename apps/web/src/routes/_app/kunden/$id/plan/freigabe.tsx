import { createFileRoute } from '@tanstack/react-router';
import { JbpApprovalPage } from '@/features/jbp/jbp-approval-pages';

export const Route = createFileRoute('/_app/kunden/$id/plan/freigabe')({
  component: function Page() {
    const { id } = Route.useParams();
    return <JbpApprovalPage place={{ side: 'supplier', relationshipId: id }} />;
  },
});
