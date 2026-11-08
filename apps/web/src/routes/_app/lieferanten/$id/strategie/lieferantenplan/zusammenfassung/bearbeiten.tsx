import { createFileRoute } from '@tanstack/react-router';
import { PlanSummaryPage } from '@/features/supplier-plan/plan-edit-pages';

export const Route = createFileRoute(
  '/_app/lieferanten/$id/strategie/lieferantenplan/zusammenfassung/bearbeiten',
)({
  component: function EditPlanSummary() {
    const { id } = Route.useParams();
    return <PlanSummaryPage relationshipId={id} />;
  },
});
