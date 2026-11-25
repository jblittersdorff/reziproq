import { createFileRoute } from '@tanstack/react-router';
import { DemoSignInPage } from '@/features/demo/demo-sign-in-page';

// DM-01, E-K0-05 (K1-b.2): Demo-Sitzung je Person ohne Login; die API lässt sie nur im
// Demo-Mandanten, nur lokal mit DEMO_SESSIONS=true und nie im Betrieb zu.
export const Route = createFileRoute('/demo/als/$person')({
  component: function DemoSignIn() {
    const { person } = Route.useParams();
    return <DemoSignInPage key={person} person={person} />;
  },
});
