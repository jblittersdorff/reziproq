import { createFileRoute } from '@tanstack/react-router';
import { AreaPage } from '@/features/workspace/area-page';

export const Route = createFileRoute('/_app/lieferanten/$id/plan/')({
  component: function PlanArea() {
    const { id } = Route.useParams();
    return <AreaPage relationshipId={id} area="plan" />;
  },
});
