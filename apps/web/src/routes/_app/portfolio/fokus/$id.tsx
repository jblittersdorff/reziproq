import { createFileRoute } from '@tanstack/react-router';
import { FocusDetailPage } from '@/features/portfolio/focus-detail-page';

export const Route = createFileRoute('/_app/portfolio/fokus/$id')({
  component: function Page() {
    const { id } = Route.useParams();
    return <FocusDetailPage id={id} />;
  },
});
