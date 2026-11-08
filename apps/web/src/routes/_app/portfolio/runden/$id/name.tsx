import { createFileRoute } from '@tanstack/react-router';
import { RoundNamePage } from '@/features/rounds/round-wizard';

export const Route = createFileRoute('/_app/portfolio/runden/$id/name')({
  component: function Page() {
    const { id } = Route.useParams();
    return <RoundNamePage id={id} key={id} />;
  },
});
