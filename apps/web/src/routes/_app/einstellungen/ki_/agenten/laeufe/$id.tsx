import { createFileRoute } from '@tanstack/react-router';
import { AgentRunPage } from '@/features/agents/agent-pages';

export const Route = createFileRoute('/_app/einstellungen/ki_/agenten/laeufe/$id')({
  component: () => <AgentRunPage id={Route.useParams().id} />,
});
