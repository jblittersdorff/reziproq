import { createFileRoute } from '@tanstack/react-router';
import { AgentsPage } from '@/features/agents/agent-pages';

export const Route = createFileRoute('/_app/einstellungen/ki_/agenten/')({
  component: AgentsPage,
});
