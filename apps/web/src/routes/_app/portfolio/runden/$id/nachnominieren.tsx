import { createFileRoute } from '@tanstack/react-router';
import { RoundNominatePage } from '@/features/rounds/round-nominate-page';

export const Route = createFileRoute('/_app/portfolio/runden/$id/nachnominieren')({
  component: function Page() {
    const { id } = Route.useParams();
    return <RoundNominatePage id={id} key={id} />;
  },
});
