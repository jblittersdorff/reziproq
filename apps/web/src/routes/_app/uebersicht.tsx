import { createFileRoute } from '@tanstack/react-router';
import { OverviewPage } from '@/features/overview/overview-page';

export const Route = createFileRoute('/_app/uebersicht')({
  component: OverviewPage,
});
