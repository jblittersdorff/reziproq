import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { QuestionsPage } from '@/features/prompt/questions-page';

export const Route = createFileRoute('/_app/fragen')({
  validateSearch: z.object({ q: z.string().optional(), kunde: z.uuid().optional() }),
  component: QuestionsRoute,
});

function QuestionsRoute() {
  const { q, kunde } = Route.useSearch();
  return <QuestionsPage initialQuestion={q} customer={kunde} />;
}
