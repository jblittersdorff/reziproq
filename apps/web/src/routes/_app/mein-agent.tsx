import { createFileRoute } from '@tanstack/react-router';
import { MyAgentPage } from '@/features/agents/my-agent-page';

// NAV-10 2.0, MA-01 (K1-f.3): Mein Agent, die eigenen Stufen je Aufgabe von Reziproq
export const Route = createFileRoute('/_app/mein-agent')({
  component: MyAgentPage,
});
