import { createFileRoute } from '@tanstack/react-router';
import { MapPage } from '@/features/today/map-page';

// HE-01 Fokus-Mappe (K1-e.4); die Art im Pfad nennt, worum es geht (z. B. freigabe, hinweis)
export const Route = createFileRoute('/_app/mappe/$art/$id')({
  component: function FocusFolder() {
    const { id } = Route.useParams();
    return <MapPage id={id} />;
  },
});
