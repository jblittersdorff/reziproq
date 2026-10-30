import { createFileRoute } from '@tanstack/react-router';
import { QbrsPage } from '@/features/qbrs/qbrs-page';

export const Route = createFileRoute('/_app/qbrs')({
  component: QbrsPage,
});
