import { createFileRoute } from '@tanstack/react-router';
import { ContributionPage } from '@/features/supplier-plan/contribution-pages';

export const Route = createFileRoute(
  '/_app/lieferanten/$id/strategie/lieferantenplan/beitrag/$contributionId',
)({
  component: function PlanContribution() {
    const { id, contributionId } = Route.useParams();
    return <ContributionPage relationshipId={id} contributionId={contributionId} />;
  },
});
