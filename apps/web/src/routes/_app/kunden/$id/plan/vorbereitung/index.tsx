import { createFileRoute } from '@tanstack/react-router';
import { JbpPreparationPage } from '@/features/jbp/jbp-pages';

export const Route = createFileRoute('/_app/kunden/$id/plan/vorbereitung/')({
  component: function Page() {
    const { id } = Route.useParams();
    return <JbpPreparationPage place={{ side: 'supplier', relationshipId: id }} />;
  },
});
