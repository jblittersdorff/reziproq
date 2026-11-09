import { createFileRoute } from '@tanstack/react-router';
import { PlanVersionsPage } from '@/features/supplier-plan/approval-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/lieferantenplan/versionen')({
  component: function Page() {
    const { id } = Route.useParams();
    return <PlanVersionsPage relationshipId={id} />;
  },
});
