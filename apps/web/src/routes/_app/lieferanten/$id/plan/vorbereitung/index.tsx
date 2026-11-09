import { createFileRoute } from '@tanstack/react-router';
import { JbpPreparationPage } from '@/features/jbp/jbp-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/plan/vorbereitung/')({
  component: function Page() {
    const { id } = Route.useParams();
    return <JbpPreparationPage place={{ side: 'buyer', relationshipId: id }} />;
  },
});
