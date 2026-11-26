import { createFileRoute } from '@tanstack/react-router';
import { SegmentGridPage } from '@/features/segment-model/segment-model-page';

// E-K0-33 (K2-b.1): Raster 2 × 2 oder 3 × 3 und Namen der Achsen
export const Route = createFileRoute('/_app/einstellungen/segmentmodell/raster')({
  component: SegmentGridPage,
});
