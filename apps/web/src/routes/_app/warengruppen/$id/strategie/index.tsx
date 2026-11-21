import { createFileRoute } from '@tanstack/react-router';
import { StrategyEntryPage } from '@/features/material-groups/strategy-pages';

export const Route = createFileRoute('/_app/warengruppen/$id/strategie/')({
  component: function StrategyEntry() {
    const { id } = Route.useParams();
    return <StrategyEntryPage key={id} groupId={id} />;
  },
});
