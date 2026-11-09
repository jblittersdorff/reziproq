import { createFileRoute, redirect } from '@tanstack/react-router';
import { builtAreas } from '@/features/workspace/areas';

// Der Bereich ist ein Abschnitt auf dem Überblick (UMB-05). Ohne gebaute Unterseite führt die
// Adresse zum Überblick selbst.
export const Route = createFileRoute('/_app/lieferanten/$id/strategie/')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/lieferanten/$id',
      params: { id: params.id },
      ...(builtAreas.includes('strategy') ? { hash: 'strategie' } : {}),
    });
  },
});
