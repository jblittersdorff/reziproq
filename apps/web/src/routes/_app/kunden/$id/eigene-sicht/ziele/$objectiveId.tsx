import { createFileRoute } from '@tanstack/react-router';
import { OwnObjectivePage } from '@/features/customers/own-view-pages';

export const Route = createFileRoute('/_app/kunden/$id/eigene-sicht/ziele/$objectiveId')({
  component: function Page() {
    const params = Route.useParams();
    return <OwnObjectivePage relationshipId={params.id} objectiveId={params.objectiveId} />;
  },
});
