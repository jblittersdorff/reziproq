import { createFileRoute, redirect } from '@tanstack/react-router';

// Die Startseite ist die Übersicht (PLT-11).
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/uebersicht', replace: true });
  },
});
