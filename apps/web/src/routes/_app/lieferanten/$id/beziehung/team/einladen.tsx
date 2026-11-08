import { createFileRoute } from '@tanstack/react-router';
import { InvitePage } from '@/features/invitations/invite-page';

export const Route = createFileRoute('/_app/lieferanten/$id/beziehung/team/einladen')({
  component: function Invite() {
    const { id } = Route.useParams();
    return <InvitePage key={id} relationshipId={id} />;
  },
});
