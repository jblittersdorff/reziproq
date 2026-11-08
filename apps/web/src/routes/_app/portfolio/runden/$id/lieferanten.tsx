import { createFileRoute } from '@tanstack/react-router';
import { RoundSuppliersPage } from '@/features/rounds/round-wizard';

export const Route = createFileRoute('/_app/portfolio/runden/$id/lieferanten')({
  component: function Page() {
    const { id } = Route.useParams();
    return <RoundSuppliersPage id={id} key={id} />;
  },
});
