import { createFileRoute } from '@tanstack/react-router';
import { ExtendWavePage } from '@/features/feedback/wave-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/beziehung/feedback/$waveId/frist')({
  component: function Page() {
    const params = Route.useParams();
    return <ExtendWavePage relationshipId={params.id} waveId={params.waveId} />;
  },
});
