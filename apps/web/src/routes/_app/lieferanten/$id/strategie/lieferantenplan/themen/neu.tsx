import { createFileRoute } from '@tanstack/react-router';
import { StrategicTopicPage } from '@/features/supplier-plan/topic-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/lieferantenplan/themen/neu')({
  component: function NewStrategicTopic() {
    const { id } = Route.useParams();
    return <StrategicTopicPage relationshipId={id} />;
  },
});
