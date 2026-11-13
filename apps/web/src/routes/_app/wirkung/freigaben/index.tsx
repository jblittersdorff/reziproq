import { createFileRoute } from '@tanstack/react-router';
import { ValidationsPage } from '@/features/impact/validation-pages';

export const Route = createFileRoute('/_app/wirkung/freigaben/')({
  component: ValidationsPage,
});
