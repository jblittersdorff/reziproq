import { createFileRoute, redirect } from '@tanstack/react-router';

// NAV-10 1.1: Die alten Bereiche sind keine Abschnitte des Überblicks mehr. Die Adresse leitet auf
// die erste Seite ihres neuen Bereichs weiter: Team (Profil).
export const Route = createFileRoute('/_app/lieferanten/$id/beziehung/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/lieferanten/$id/beziehung/team', params: { id: params.id }, replace: true });
  },
});
