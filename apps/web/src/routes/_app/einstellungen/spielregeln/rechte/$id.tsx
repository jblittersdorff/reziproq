import { createFileRoute } from '@tanstack/react-router';
import { RuleFormPage } from '@/features/playbook/rules-pages';

export const Route = createFileRoute('/_app/einstellungen/spielregeln/rechte/$id')({
  component: function Page() {
    const { id } = Route.useParams();
    return <RuleFormPage key={id} id={id} />;
  },
});
