import { createFileRoute } from '@tanstack/react-router';
import { SurveyQuestionPage } from '@/features/feedback/survey-pages';

export const Route = createFileRoute('/_app/einstellungen/fragebogen/$kind/$questionKey')({
  component: function Page() {
    const { kind, questionKey } = Route.useParams();
    return <SurveyQuestionPage kind={kind} questionKey={questionKey} />;
  },
});
