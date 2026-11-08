import { createFileRoute } from '@tanstack/react-router';
import { SegmentCriterionPage } from '@/features/segment-model/segment-model-page';

export const Route = createFileRoute('/_app/einstellungen/segmentmodell/kriterium/$key')({
  component: function EditSegmentCriterion() {
    const { key } = Route.useParams();
    return <SegmentCriterionPage criterionKey={key} />;
  },
});
