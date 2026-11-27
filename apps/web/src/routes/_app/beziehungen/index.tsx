import { createFileRoute } from '@tanstack/react-router';
import { relationshipSearchSchema } from '@/features/relationships/relationship-view';
import { RelationshipsPage } from '@/features/relationships/relationships-page';
import { SegmentsLens } from '@/features/relationships/segments-lens';

// BZ-01: Seite Lieferanten mit den Linsen Liste und Segmente (`?linse=segmente`). Alte Adressen
// der Matrix (`?ansicht=matrix`, `?ansicht=runde`) öffnen bis K2-b.5 die Linse Segmente.
export const Route = createFileRoute('/_app/beziehungen/')({
  validateSearch: relationshipSearchSchema,
  component: RelationshipViews,
});

function RelationshipViews() {
  const search = Route.useSearch();
  return search.linse === 'segmente' || search.ansicht !== undefined ? (
    <SegmentsLens />
  ) : (
    <RelationshipsPage />
  );
}
