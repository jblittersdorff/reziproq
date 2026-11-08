import { createFileRoute, Outlet } from '@tanstack/react-router';
import { AcceptLayout } from '@/features/invitations/accept-pages';

// Ohne Login (LIF-01a): Der Token im Link ist der einzige Schlüssel.
export const Route = createFileRoute('/einladung/$token')({
  component: function Invitation() {
    const { token } = Route.useParams();
    return (
      <AcceptLayout key={token} token={token}>
        <Outlet />
      </AcceptLayout>
    );
  },
});
