import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { DemoSignInPage } from '@/features/demo/demo-sign-in-page';

// DM-01, E-K0-05 (K1-b.2): Demo-Sitzung je Person ohne Login; die API lässt sie nur im
// Demo-Mandanten, nur lokal mit DEMO_SESSIONS=true und nie im Betrieb zu.
// `zurueck`: Neustart einer abgelaufenen Sitzung kehrt auf die Seite zurück (lib/demo-session.ts).
export const Route = createFileRoute('/demo/als/$person')({
  validateSearch: z.object({ zurueck: z.string().optional().catch(undefined) }),
  component: function DemoSignIn() {
    const { person } = Route.useParams();
    const { zurueck } = Route.useSearch();
    return (
      <DemoSignInPage
        key={person}
        person={person}
        {...(zurueck === undefined ? {} : { returnTo: zurueck })}
      />
    );
  },
});
