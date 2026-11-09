import { createFileRoute } from '@tanstack/react-router';
import { JbpTopicFormPage } from '@/features/jbp/jbp-topic-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/plan/themen/neu')({
  component: function Page() {
    const { id } = Route.useParams();
    return <JbpTopicFormPage place={{ side: 'buyer', relationshipId: id }} />;
  },
});
