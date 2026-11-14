import { createFileRoute } from '@tanstack/react-router';
import { WavesPage } from '@/features/feedback/wave-pages';

export const Route = createFileRoute('/_app/kunden/$id/beziehung/feedback/')({
  component: function Page() {
    const params = Route.useParams();
    return <WavesPage side="supplier" relationshipId={params.id} />;
  },
});
