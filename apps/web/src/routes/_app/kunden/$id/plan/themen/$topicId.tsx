import { createFileRoute } from '@tanstack/react-router';
import { JbpTopicFormPage } from '@/features/jbp/jbp-topic-pages';

export const Route = createFileRoute('/_app/kunden/$id/plan/themen/$topicId')({
  component: function Page() {
    const { id, topicId } = Route.useParams();
    return <JbpTopicFormPage place={{ side: 'supplier', relationshipId: id }} topicId={topicId} />;
  },
});
