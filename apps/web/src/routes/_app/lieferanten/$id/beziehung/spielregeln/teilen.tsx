import { createFileRoute } from '@tanstack/react-router';
import { RuleSetSharePage } from '@/features/playbook/rule-set-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/beziehung/spielregeln/teilen')({
  component: function Page() {
    const { id } = Route.useParams();
    return <RuleSetSharePage key={id} relationshipId={id} />;
  },
});
