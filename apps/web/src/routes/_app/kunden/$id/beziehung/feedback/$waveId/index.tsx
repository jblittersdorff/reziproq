import { createFileRoute } from '@tanstack/react-router';
import { WavePage } from '@/features/feedback/wave-pages';

export const Route = createFileRoute('/_app/kunden/$id/beziehung/feedback/$waveId/')({
  component: function Page() {
    const params = Route.useParams();
    return <WavePage side="supplier" relationshipId={params.id} waveId={params.waveId} />;
  },
});
