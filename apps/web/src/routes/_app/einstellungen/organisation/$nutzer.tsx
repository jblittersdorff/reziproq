import { createFileRoute } from '@tanstack/react-router';
import { MemberPage } from '@/features/settings/member-page';

export const Route = createFileRoute('/_app/einstellungen/organisation/$nutzer')({
  component: function Member() {
    const { nutzer } = Route.useParams();
    return <MemberPage key={nutzer} userId={nutzer} />;
  },
});
