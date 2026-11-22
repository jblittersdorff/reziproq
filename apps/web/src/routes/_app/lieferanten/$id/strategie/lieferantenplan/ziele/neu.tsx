import { createFileRoute } from '@tanstack/react-router';
import { PlanObjectivePage } from '@/features/supplier-plan/plan-edit-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/lieferantenplan/ziele/neu')({
  component: function NewPlanObjective() {
    const { id } = Route.useParams();
    return <PlanObjectivePage relationshipId={id} />;
  },
});
