import { createFileRoute, redirect } from '@tanstack/react-router';
import { relationshipSearchSchema } from '@/features/relationships/relationship-view';
import { RelationshipsPage } from '@/features/relationships/relationships-page';
import { SegmentsPage } from '@/features/relationships/segments-page';

// BZ-01: Seite Lieferanten mit den Linsen Liste und Segmente (`?linse=segmente`); `/portfolio` leitet
// auf die Linse Segmente weiter (K2-b.5). Übergänge bis K2-e: Die Linse Segmente mit Warengruppe oder
// Business Unit (`/portfolio?warengruppe=<id>`, WG-18) öffnet die bisherige Matrix mit Filtern, und
// die alte Ansicht Runde (`?ansicht=runde`) die Bewertungsrunden.
export const Route = createFileRoute('/_app/beziehungen/')({
  validateSearch: relationshipSearchSchema,
  beforeLoad: ({ search }) => {
    if (search.ansicht === 'runde') throw redirect({ to: '/portfolio/runden', replace: true });
    const segments = search.linse === 'segmente' || search.ansicht === 'matrix';
    const group = search.warengruppe ?? search.wg;
    if (segments && (group || search.bu)) {
      throw redirect({
        to: '/portfolio/matrix',
        search: {
          ...(group ? { wg: group } : {}),
          ...(search.bu ? { bu: search.bu } : {}),
          ...(search.segmente ? { ansicht: search.segmente } : {}),
        },
        replace: true,
      });
    }
  },
  component: RelationshipViews,
});

function RelationshipViews() {
  const search = Route.useSearch();
  return search.linse === 'segmente' || search.ansicht === 'matrix' ? (
    <SegmentsPage />
  ) : (
    <RelationshipsPage />
  );
}
