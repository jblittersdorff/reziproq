import { createFileRoute } from '@tanstack/react-router';
import { InAppAnswerPage } from '@/features/feedback/answer-page';

// Feedback in der App: eigene Einladung, angemeldet beantworten (beide Seiten).
export const Route = createFileRoute('/_app/feedback/$id')({
  component: function MyFeedbackSurvey() {
    const { id } = Route.useParams();
    return <InAppAnswerPage key={id} invitationId={id} />;
  },
});
