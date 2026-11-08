import { createFileRoute } from '@tanstack/react-router';
import { ContributionRequestPage } from '@/features/supplier-plan/contribution-pages';

export const Route = createFileRoute(
  '/_app/lieferanten/$id/strategie/lieferantenplan/beitraege/neu',
)({
  component: function NewContributions() {
    const { id } = Route.useParams();
    return <ContributionRequestPage relationshipId={id} />;
  },
});
