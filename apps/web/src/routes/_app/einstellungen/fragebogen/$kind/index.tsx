import { createFileRoute } from '@tanstack/react-router';
import { SurveyPage } from '@/features/feedback/survey-pages';

export const Route = createFileRoute('/_app/einstellungen/fragebogen/$kind/')({
  component: function Page() {
    const { kind } = Route.useParams();
    return <SurveyPage kind={kind} />;
  },
});
