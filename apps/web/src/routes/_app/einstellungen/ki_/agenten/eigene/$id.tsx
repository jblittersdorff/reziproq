import { createFileRoute } from '@tanstack/react-router';
import { CustomAgentPage } from '@/features/agents/custom-agent-pages';

export const Route = createFileRoute('/_app/einstellungen/ki_/agenten/eigene/$id')({
  component: () => <CustomAgentPage id={Route.useParams().id} />,
});
