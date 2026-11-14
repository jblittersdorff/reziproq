import { createFileRoute } from '@tanstack/react-router';
import { TouchpointFormPage } from '@/features/touchpoints/touchpoint-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/beziehung/kontaktpunkte/$touchpointId')(
  {
    component: function EditTouchpoint() {
      const { id, touchpointId } = Route.useParams();
      return (
        <TouchpointFormPage key={touchpointId} relationshipId={id} touchpointId={touchpointId} />
      );
    },
  },
);
