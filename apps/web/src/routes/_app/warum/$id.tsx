import { createFileRoute } from '@tanstack/react-router';
import { WhyPage } from '@/features/today/why-page';

// HE-01 Warum (K1-e.4): Herleitung zu einem Fokus-Thema, einem Hinweis oder einem Lauf
export const Route = createFileRoute('/_app/warum/$id')({
  component: function Why() {
    const { id } = Route.useParams();
    return <WhyPage id={id} />;
  },
});
