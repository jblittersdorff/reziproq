import { createFileRoute } from '@tanstack/react-router';
import { SegmentBoundariesPage } from '@/features/segment-model/segment-model-page';

export const Route = createFileRoute('/_app/einstellungen/segmentmodell/grenzen')({
  component: SegmentBoundariesPage,
});
