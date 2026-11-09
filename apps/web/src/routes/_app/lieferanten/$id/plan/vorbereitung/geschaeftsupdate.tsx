import { createFileRoute } from '@tanstack/react-router';
import { BusinessUpdatePage } from '@/features/jbp/jbp-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/plan/vorbereitung/geschaeftsupdate')({
  component: function Page() {
    const { id } = Route.useParams();
    return <BusinessUpdatePage place={{ side: 'buyer', relationshipId: id }} />;
  },
});
