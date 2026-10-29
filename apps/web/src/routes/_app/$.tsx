import { createFileRoute } from '@tanstack/react-router';
import { NotFoundPage } from '@/features/shell/not-found-page';

// Fängt alle unbekannten Adressen ab, innerhalb des Rahmens und nur mit Login.
export const Route = createFileRoute('/_app/$')({
  component: NotFoundPage,
});
