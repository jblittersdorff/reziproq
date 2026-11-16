import { createFileRoute } from '@tanstack/react-router';
import { MyFeedbackPage } from '@/features/feedback/my-feedback';

export const Route = createFileRoute('/_app/feedback/')({
  component: MyFeedbackPage,
});
