import { createFileRoute } from '@tanstack/react-router';
import { OpenPage } from '@/features/portfolio/open-page';

export const Route = createFileRoute('/_app/portfolio/offen')({
  component: OpenPage,
});
