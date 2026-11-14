import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { NewWavePage } from '@/features/feedback/wave-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/beziehung/feedback/neu')({
  validateSearch: z.object({ schritt: z.coerce.number().int().min(1).max(3).optional() }),
  component: function Page() {
    const { id } = Route.useParams();
    const { schritt } = Route.useSearch();
    return <NewWavePage relationshipId={id} step={schritt ?? 1} />;
  },
});
