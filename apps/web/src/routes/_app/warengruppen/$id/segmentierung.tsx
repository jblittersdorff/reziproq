import { createFileRoute } from '@tanstack/react-router';
import { CategorySegmentationPage } from '@/features/material-groups/segmentation-pages';

// WG-18: Bewertungsrunde und Segment je Lieferant in der Warengruppe
export const Route = createFileRoute('/_app/warengruppen/$id/segmentierung')({
  component: function CategorySegmentation() {
    const { id } = Route.useParams();
    return <CategorySegmentationPage key={id} groupId={id} />;
  },
});
