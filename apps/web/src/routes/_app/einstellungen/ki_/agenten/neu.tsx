import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { CustomAgentNewPage } from '@/features/agents/custom-agent-pages';

// KI-09: aufgabe übernimmt eine Frage von der Seite „Fragen“ als Aufgabe.
export const Route = createFileRoute('/_app/einstellungen/ki_/agenten/neu')({
  validateSearch: z.object({ aufgabe: z.string().max(2000).optional().catch(undefined) }),
  component: () => <CustomAgentNewPage task={Route.useSearch().aufgabe} />,
});
