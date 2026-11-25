import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ReviewPage } from '@/features/today/review-page';

// HE-01 Kurz prüfen (K1-e.2); ?entwurf=<id> beginnt bei diesem Entwurf (Zeile auf Heute).
export const Route = createFileRoute('/_app/kurz-pruefen')({
  validateSearch: z.object({ entwurf: z.uuid().optional().catch(undefined) }),
  component: function Review() {
    const { entwurf } = Route.useSearch();
    return <ReviewPage start={entwurf} />;
  },
});
