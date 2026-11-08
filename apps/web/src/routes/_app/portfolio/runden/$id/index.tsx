import { createFileRoute } from '@tanstack/react-router';
import { RoundPage } from '@/features/rounds/round-page';

export const Route = createFileRoute('/_app/portfolio/runden/$id/')({
  component: function Page() {
    const { id } = Route.useParams();
    return <RoundPage id={id} />;
  },
});
