import { createFileRoute } from '@tanstack/react-router';
import { InvitePage } from '@/features/feedback/wave-pages';

export const Route = createFileRoute('/_app/kunden/$id/beziehung/feedback/$waveId/einladen')({
  component: function Page() {
    const params = Route.useParams();
    return <InvitePage side="supplier" relationshipId={params.id} waveId={params.waveId} />;
  },
});
