import { createFileRoute } from '@tanstack/react-router';
import { RuleSetProposalPage } from '@/features/playbook/rule-set-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/beziehung/spielregeln/vorschlag')({
  component: function Page() {
    const { id } = Route.useParams();
    return <RuleSetProposalPage key={id} relationshipId={id} />;
  },
});
