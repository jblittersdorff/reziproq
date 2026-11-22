import { createFileRoute } from '@tanstack/react-router';
import { ValueOverviewPage } from '@/features/opportunities/overview-page';

export const Route = createFileRoute('/_app/uebersicht/wertpotenziale')({
  component: ValueOverviewPage,
});
