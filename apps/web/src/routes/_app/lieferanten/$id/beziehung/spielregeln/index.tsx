import { createFileRoute } from '@tanstack/react-router';
import { RuleSetPage } from '@/features/playbook/rule-set-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/beziehung/spielregeln/')({
  component: function Page() {
    const { id } = Route.useParams();
    return <RuleSetPage key={id} relationshipId={id} />;
  },
});
