import { createFileRoute } from '@tanstack/react-router';
import { RuleFormPage } from '@/features/playbook/rules-pages';

export const Route = createFileRoute('/_app/einstellungen/spielregeln/rechte/neu')({
  component: () => <RuleFormPage />,
});
