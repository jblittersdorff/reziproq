import { createFileRoute } from '@tanstack/react-router';
import { SurveyQuestionPage } from '@/features/feedback/survey-pages';

export const Route = createFileRoute('/_app/einstellungen/fragebogen/$kind/neu')({
  component: function Page() {
    const { kind } = Route.useParams();
    return <SurveyQuestionPage kind={kind} />;
  },
});
