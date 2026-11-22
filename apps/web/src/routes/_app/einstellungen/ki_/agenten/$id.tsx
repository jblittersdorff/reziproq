import { createFileRoute } from '@tanstack/react-router';
import { AgentPage } from '@/features/agents/agent-pages';

export const Route = createFileRoute('/_app/einstellungen/ki_/agenten/$id')({
  component: () => <AgentPage id={Route.useParams().id} />,
});
