import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { QuestionsPage } from '@/features/prompt/questions-page';

export const Route = createFileRoute('/_app/fragen')({
  validateSearch: z.object({ q: z.string().optional() }),
  component: QuestionsRoute,
});

function QuestionsRoute() {
  const { q } = Route.useSearch();
  return <QuestionsPage initialQuestion={q} />;
}
