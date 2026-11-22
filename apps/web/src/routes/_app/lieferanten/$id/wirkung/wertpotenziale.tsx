import { createFileRoute } from '@tanstack/react-router';
import { ValueOpportunitiesPage } from '@/features/opportunities/opportunity-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/wirkung/wertpotenziale')({
  component: function ValueOpportunities() {
    const { id } = Route.useParams();
    return <ValueOpportunitiesPage key={id} relationshipId={id} />;
  },
});
