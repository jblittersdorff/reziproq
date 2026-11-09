import { createFileRoute } from '@tanstack/react-router';
import { JbpTopicsPage } from '@/features/jbp/jbp-topic-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/plan/themen/')({
  component: function Page() {
    const { id } = Route.useParams();
    return <JbpTopicsPage place={{ side: 'buyer', relationshipId: id }} />;
  },
});
