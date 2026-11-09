import { createFileRoute } from '@tanstack/react-router';
import { JbpTopicFormPage } from '@/features/jbp/jbp-topic-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/plan/themen/$topicId')({
  component: function Page() {
    const { id, topicId } = Route.useParams();
    return <JbpTopicFormPage place={{ side: 'buyer', relationshipId: id }} topicId={topicId} />;
  },
});
