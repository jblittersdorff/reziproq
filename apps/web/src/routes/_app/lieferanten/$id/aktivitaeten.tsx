import { createFileRoute } from '@tanstack/react-router';
import { ActivitiesPage } from '@/features/activities/activities-page';

// NAV-10: Aktivitäten › Verlauf eines Lieferanten
export const Route = createFileRoute('/_app/lieferanten/$id/aktivitaeten')({
  component: function Activities() {
    const { id } = Route.useParams();
    return <ActivitiesPage key={id} relationshipId={id} />;
  },
});
