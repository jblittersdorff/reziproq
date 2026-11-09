import { createFileRoute } from '@tanstack/react-router';
import { PlanApprovalPage } from '@/features/supplier-plan/approval-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/lieferantenplan/freigabe')({
  component: function Page() {
    const { id } = Route.useParams();
    return <PlanApprovalPage relationshipId={id} />;
  },
});
