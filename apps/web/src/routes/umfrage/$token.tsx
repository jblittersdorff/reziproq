import { createFileRoute } from '@tanstack/react-router';
import { AnswerPage } from '@/features/feedback/answer-page';

// Ohne Login (PUL-02b): Der Token im Link ist der einzige Schlüssel.
export const Route = createFileRoute('/umfrage/$token')({
  component: function Survey() {
    const { token } = Route.useParams();
    return <AnswerPage key={token} token={token} />;
  },
});
