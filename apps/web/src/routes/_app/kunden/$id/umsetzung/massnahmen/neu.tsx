import { surveyDimensions } from '@reziproq/shared';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { NewActionPage } from '@/features/actions/action-pages';

export const Route = createFileRoute('/_app/kunden/$id/umsetzung/massnahmen/neu')({
  // ?termin=<id>: Maßnahme aus einem Termin (QBR-03)
  // ?luecke=<Ergebniszeile>&dimension=<Dimension>: Maßnahme aus einer Feedback-Lücke (PUL-06)
  validateSearch: z.object({
    termin: z.uuid().optional(),
    luecke: z.uuid().optional(),
    dimension: z.enum(surveyDimensions).optional(),
  }),
  component: function Page() {
    const { id } = Route.useParams();
    const { termin, luecke, dimension } = Route.useSearch();
    return (
      <NewActionPage
        place={{ side: 'supplier', relationshipId: id }}
        {...(termin ? { meetingId: termin } : {})}
        {...(luecke && dimension ? { gap: { resultId: luecke, dimension } } : {})}
      />
    );
  },
});
