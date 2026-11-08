import { createFileRoute } from '@tanstack/react-router';
import { SegmentTypePage } from '@/features/segment-model/segment-model-page';

export const Route = createFileRoute('/_app/einstellungen/segmentmodell/typ/$pair')({
  component: function EditSegmentType() {
    const { pair } = Route.useParams();
    return <SegmentTypePage pair={pair} />;
  },
});
