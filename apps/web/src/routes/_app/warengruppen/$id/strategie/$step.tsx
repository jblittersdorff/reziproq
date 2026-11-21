import { createFileRoute } from '@tanstack/react-router';
import { StrategyStepPage } from '@/features/material-groups/strategy-pages';

// WG-04: jeder Schritt hat eine eigene Adresse und ist frei anspringbar.
export const Route = createFileRoute('/_app/warengruppen/$id/strategie/$step')({
  component: function StrategyStep() {
    const { id, step } = Route.useParams();
    return <StrategyStepPage key={`${id}-${step}`} groupId={id} step={Number(step)} />;
  },
});
