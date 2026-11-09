import { createFileRoute } from '@tanstack/react-router';
import { JbpTopicMergePage } from '@/features/jbp/jbp-initiative-pages';

export const Route = createFileRoute('/_app/kunden/$id/plan/themen/zusammenfuehren')({
  component: function Page() {
    const { id } = Route.useParams();
    return <JbpTopicMergePage place={{ side: 'supplier', relationshipId: id }} />;
  },
});
