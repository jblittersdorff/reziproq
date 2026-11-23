import { surveyDimensions } from '@reziproq/shared';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { NewActionPage } from '@/features/actions/action-pages';

export const Route = createFileRoute('/_app/lieferanten/$id/umsetzung/massnahmen/neu')({
  // ?termin=<id>: Maßnahme aus einem Termin (QBR-03)
  // ?luecke=<Ergebniszeile>&dimension=<Dimension>: Maßnahme aus einer Feedback-Lücke (PUL-06)
  // ?hinweis=<id>: Maßnahme aus einem Hinweis der Frühwarnung, vorausgefüllt (KI-16)
  validateSearch: z.object({
    termin: z.uuid().optional(),
    hinweis: z.uuid().optional(),
    luecke: z.uuid().optional(),
    dimension: z.enum(surveyDimensions).optional(),
  }),
  component: function Page() {
    const { id } = Route.useParams();
    const { termin, hinweis, luecke, dimension } = Route.useSearch();
    return (
      <NewActionPage
        place={{ side: 'buyer', relationshipId: id }}
        {...(termin ? { meetingId: termin } : {})}
        {...(hinweis ? { hintId: hinweis } : {})}
        {...(luecke && dimension ? { gap: { resultId: luecke, dimension } } : {})}
      />
    );
  },
});
