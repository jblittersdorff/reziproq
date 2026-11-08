import { createFileRoute } from '@tanstack/react-router';
import { RuleSetEditPage } from '@/features/playbook/rule-set-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/beziehung/spielregeln/bearbeiten')({
  component: function Page() {
    const { id } = Route.useParams();
    return <RuleSetEditPage key={id} relationshipId={id} />;
  },
});
