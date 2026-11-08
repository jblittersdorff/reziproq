import { createFileRoute } from '@tanstack/react-router';
import { SegmentationPage } from '@/features/segmentation/segmentation-page';

export const Route = createFileRoute('/_app/lieferanten/$id/strategie/segmentierung/')({
  component: function Segmentation() {
    const { id } = Route.useParams();
    return <SegmentationPage key={id} relationshipId={id} />;
  },
});
