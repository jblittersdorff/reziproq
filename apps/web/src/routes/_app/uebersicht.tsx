import { createFileRoute, redirect } from '@tanstack/react-router';

// Frühere Startseite; Lesezeichen führen jetzt zu Start (PLT-11).
export const Route = createFileRoute('/_app/uebersicht')({
  beforeLoad: () => {
    throw redirect({ to: '/start', replace: true });
  },
});
