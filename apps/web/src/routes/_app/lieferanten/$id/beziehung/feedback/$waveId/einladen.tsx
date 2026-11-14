import { createFileRoute } from '@tanstack/react-router';
import { InvitePage } from '@/features/feedback/wave-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/beziehung/feedback/$waveId/einladen')({
  component: function Page() {
    const params = Route.useParams();
    return <InvitePage side="buyer" relationshipId={params.id} waveId={params.waveId} />;
  },
});
