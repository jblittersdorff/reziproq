import { createFileRoute } from '@tanstack/react-router';
import { SurveyPreviewPage } from '@/features/feedback/survey-pages';

export const Route = createFileRoute('/_app/einstellungen/fragebogen/$kind/vorschau')({
  component: function Page() {
    const { kind } = Route.useParams();
    return <SurveyPreviewPage kind={kind} />;
  },
});
