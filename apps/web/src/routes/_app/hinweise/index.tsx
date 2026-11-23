import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { HintsPage } from '@/features/hints/hints-pages';

export const Route = createFileRoute('/_app/hinweise/')({
  // ?hinweis=<id>: öffnet rechts die Leiste des Hinweises (KI-16)
  validateSearch: z.object({ hinweis: z.uuid().optional() }),
  component: function Hints() {
    const { hinweis } = Route.useSearch();
    return <HintsPage selectedId={hinweis} />;
  },
});
