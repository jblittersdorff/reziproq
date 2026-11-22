import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { QuestionsPage } from '@/features/prompt/questions-page';

export const Route = createFileRoute('/_app/fragen')({
  // NAV-10: lieferant gibt der Frage den Lieferanten als Kontext.
  validateSearch: z.object({
    q: z.string().optional(),
    kunde: z.uuid().optional(),
    lieferant: z.uuid().optional().catch(undefined),
  }),
  component: QuestionsRoute,
});

function QuestionsRoute() {
  const { q, kunde, lieferant } = Route.useSearch();
  return <QuestionsPage initialQuestion={q} customer={kunde} supplier={lieferant} />;
}
