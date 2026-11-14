import { createFileRoute } from '@tanstack/react-router';
import { TouchpointsPage } from '@/features/touchpoints/touchpoint-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/beziehung/kontaktpunkte/')({
  component: function Touchpoints() {
    const { id } = Route.useParams();
    return <TouchpointsPage key={id} relationshipId={id} />;
  },
});
