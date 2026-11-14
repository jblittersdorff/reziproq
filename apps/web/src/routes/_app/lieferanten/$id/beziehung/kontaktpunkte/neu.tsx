import { createFileRoute } from '@tanstack/react-router';
import { TouchpointFormPage } from '@/features/touchpoints/touchpoint-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/beziehung/kontaktpunkte/neu')({
  component: function NewTouchpoint() {
    const { id } = Route.useParams();
    return <TouchpointFormPage key={id} relationshipId={id} />;
  },
});
