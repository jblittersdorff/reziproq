import { createFileRoute } from '@tanstack/react-router';
import { SurveysPage } from '@/features/feedback/survey-pages';

export const Route = createFileRoute('/_app/einstellungen/fragebogen/')({
  component: SurveysPage,
});
