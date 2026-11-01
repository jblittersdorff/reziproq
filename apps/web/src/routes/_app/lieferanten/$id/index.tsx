import { createFileRoute, redirect } from '@tanstack/react-router';

// Den Überblick des Lieferanten baut NAV-06; bis dahin führt die Adresse zum Profil (PLT-03b).
export const Route = createFileRoute('/_app/lieferanten/$id/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/lieferanten/$id/strategie/profil', params, replace: true });
  },
});
