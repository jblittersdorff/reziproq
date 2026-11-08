import { createFileRoute } from '@tanstack/react-router';
import { SegmentModelPage } from '@/features/segment-model/segment-model-page';

export const Route = createFileRoute('/_app/einstellungen/segmentmodell/')({
  component: SegmentModelPage,
});
