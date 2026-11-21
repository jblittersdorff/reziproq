import { createFileRoute } from '@tanstack/react-router';
import { StrategyOverviewPage } from '@/features/material-groups/strategy-pages';

// WG-04: Warengruppen mit Strategie je Jahr (WG-Uebersicht.dc.html)
export const Route = createFileRoute('/_app/warengruppen/')({
  component: StrategyOverviewPage,
});
