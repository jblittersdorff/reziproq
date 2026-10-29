import { createFileRoute } from '@tanstack/react-router';
import { PnlImpactPage } from '@/features/pnl-impact/pnl-impact-page';

export const Route = createFileRoute('/_app/pnl')({
  component: PnlImpactPage,
});
