import { createFileRoute } from '@tanstack/react-router';
import { SegmentWeightsPage } from '@/features/segment-model/segment-model-page';

export const Route = createFileRoute('/_app/einstellungen/segmentmodell/gewichte')({
  component: SegmentWeightsPage,
});
