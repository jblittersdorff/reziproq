import { createFileRoute } from '@tanstack/react-router';
import { PlanObjectivePage } from '@/features/supplier-plan/plan-edit-pages';

export const Route = createFileRoute(
  '/_app/lieferanten/$id/strategie/lieferantenplan/ziele/$objectiveId/bearbeiten',
)({
  component: function EditPlanObjective() {
    const { id, objectiveId } = Route.useParams();
    return <PlanObjectivePage relationshipId={id} objectiveId={objectiveId} />;
  },
});
