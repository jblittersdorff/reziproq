import { createFileRoute } from '@tanstack/react-router';
import { PulsePage } from '@/features/pulse/pulse-page';

export const Route = createFileRoute('/_app/puls')({
  component: PulsePage,
});
