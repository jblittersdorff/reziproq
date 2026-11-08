import { createFileRoute } from '@tanstack/react-router';
import { RoundRatersPage } from '@/features/rounds/round-wizard';

export const Route = createFileRoute('/_app/portfolio/runden/$id/bewertende')({
  component: function Page() {
    const { id } = Route.useParams();
    return <RoundRatersPage id={id} key={id} />;
  },
});
