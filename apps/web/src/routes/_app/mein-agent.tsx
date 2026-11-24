import { createFileRoute } from '@tanstack/react-router';
import { AgentsPage } from '@/features/agents/agent-pages';

// NAV-10 2.0: Mein Agent; bis K1-f die Seite Agenten (KI-04), danach die Stufen je Aufgabe (MA-01).
export const Route = createFileRoute('/_app/mein-agent')({
  component: AgentsPage,
});
