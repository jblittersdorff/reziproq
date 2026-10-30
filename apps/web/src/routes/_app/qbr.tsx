import { createFileRoute } from '@tanstack/react-router';
import { QbrsPage } from '@/features/qbrs/qbrs-page';

export const Route = createFileRoute('/_app/qbr')({
  component: QbrsPage,
});
