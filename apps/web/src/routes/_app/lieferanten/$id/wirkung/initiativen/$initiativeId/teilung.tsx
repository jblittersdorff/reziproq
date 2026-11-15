import { createFileRoute } from '@tanstack/react-router';
import { SharePage } from '@/features/impact/sharing-pages';

export const Route = createFileRoute(
  '/_app/lieferanten/$id/wirkung/initiativen/$initiativeId/teilung',
)({
  component: function EditShare() {
    const { id, initiativeId } = Route.useParams();
    return <SharePage key={initiativeId} relationshipId={id} initiativeId={initiativeId} />;
  },
});
