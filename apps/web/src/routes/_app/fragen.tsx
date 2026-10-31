import { createFileRoute } from '@tanstack/react-router';
import { QuestionsPage } from '@/features/prompt/questions-page';

export const Route = createFileRoute('/_app/fragen')({
  component: QuestionsPage,
});
