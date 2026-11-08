import { createFileRoute } from '@tanstack/react-router';
import { RulesPage } from '@/features/playbook/rules-pages';

export const Route = createFileRoute('/_app/einstellungen/spielregeln/rechte/')({
  component: () => <RulesPage />,
});
