import { createFileRoute } from '@tanstack/react-router';
import { OwnSummaryPage } from '@/features/customers/own-view-pages';

export const Route = createFileRoute('/_app/kunden/$id/eigene-sicht/zusammenfassung')({
  component: function Page() {
    const params = Route.useParams();
    return <OwnSummaryPage relationshipId={params.id} />;
  },
});
