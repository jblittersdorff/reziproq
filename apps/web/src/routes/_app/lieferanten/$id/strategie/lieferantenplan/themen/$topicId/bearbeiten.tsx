import { createFileRoute } from '@tanstack/react-router';
import { StrategicTopicPage } from '@/features/supplier-plan/topic-pages';

export const Route = createFileRoute(
  '/_app/lieferanten/$id/strategie/lieferantenplan/themen/$topicId/bearbeiten',
)({
  component: function EditStrategicTopic() {
    const { id, topicId } = Route.useParams();
    return <StrategicTopicPage relationshipId={id} topicId={topicId} />;
  },
});
