import { createFileRoute } from '@tanstack/react-router';
import { AktePage } from '@/features/akte/akte-page';
import { akteSearchSchema } from '@/features/akte/akte-view';

// AK-01 (K2-c): Akte einer Beziehung mit drei Sichten; ohne Parameter Gemeinsam, `?sicht=privat`
// und `?sicht=geteilt` die anderen (T2-04).
export const Route = createFileRoute('/_app/beziehungen/$id')({
  validateSearch: akteSearchSchema,
  component: function Akte() {
    const { id } = Route.useParams();
    return <AktePage key={id} relationshipId={id} />;
  },
});
