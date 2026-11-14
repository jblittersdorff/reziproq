import { createFileRoute } from '@tanstack/react-router';
import { TouchpointsPage } from '@/features/touchpoints/touchpoint-pages';

export const Route = createFileRoute('/_app/kunden/$id/beziehung/kontaktpunkte/')({
  component: function CustomerTouchpoints() {
    const { id } = Route.useParams();
    return <TouchpointsPage key={id} relationshipId={id} side="supplier" />;
  },
});
